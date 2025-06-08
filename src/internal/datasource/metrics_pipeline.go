package datasource

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"
)

// DetectorStore interface to avoid circular dependency
type DetectorStore interface {
	Get(id string) (interface{}, error)
}

// Detector interface to avoid circular dependency
type Detector interface {
	GetStatus() string
	Train(data []float64)
	Detect(data []float64) DetectionResult
}

// DetectionResult represents the result of anomaly detection
type DetectionResult struct {
	IsAnomaly bool
	Score     float64
}

// MetricsPipeline handles scheduled metrics collection and transformation
type MetricsPipeline struct {
	client        *EnhancedPrometheusClient
	detectorStore DetectorStore
	collectors    map[string]*MetricCollector
	transformers  map[string]MetricTransformer
	scheduler     *CollectionScheduler
	mu            sync.RWMutex
	stopCh        chan struct{}
	wg            sync.WaitGroup
}

// MetricTransformer defines the interface for metric transformation
type MetricTransformer interface {
	Transform(metrics []MetricResult) ([]DataPoint, error)
}

// StandardTransformer provides standard metric transformation
type StandardTransformer struct{}

// Transform converts MetricResult to DataPoint
func (st *StandardTransformer) Transform(metrics []MetricResult) ([]DataPoint, error) {
	points := make([]DataPoint, 0, len(metrics))
	
	for _, metric := range metrics {
		points = append(points, DataPoint{
			Timestamp: metric.Timestamp,
			Value:     metric.Value,
			Labels:    metric.Labels,
		})
	}
	
	return points, nil
}

// AggregationTransformer provides aggregation-based transformation
type AggregationTransformer struct {
	WindowSize   time.Duration
	AggregateFunc string // min, max, avg, sum
}

// Transform aggregates metrics over a time window
func (at *AggregationTransformer) Transform(metrics []MetricResult) ([]DataPoint, error) {
	if len(metrics) == 0 {
		return []DataPoint{}, nil
	}
	
	// Group by time window
	windows := make(map[int64][]float64)
	for _, metric := range metrics {
		window := metric.Timestamp.Unix() / int64(at.WindowSize.Seconds())
		windows[window] = append(windows[window], metric.Value)
	}
	
	// Aggregate each window
	points := make([]DataPoint, 0, len(windows))
	for window, values := range windows {
		var aggregated float64
		
		switch at.AggregateFunc {
		case "min":
			aggregated = min(values...)
		case "max":
			aggregated = max(values...)
		case "avg":
			aggregated = avg(values...)
		case "sum":
			aggregated = sum(values...)
		default:
			return nil, fmt.Errorf("unknown aggregation function: %s", at.AggregateFunc)
		}
		
		points = append(points, DataPoint{
			Timestamp: time.Unix(window*int64(at.WindowSize.Seconds()), 0),
			Value:     aggregated,
			Labels:    metrics[0].Labels, // Use labels from first metric
		})
	}
	
	return points, nil
}

// MetricCollector represents a scheduled metric collection task
type MetricCollector struct {
	ID           string
	Query        string
	Interval     time.Duration
	DetectorID   string
	Transformer  MetricTransformer
	lastRun      time.Time
	mu           sync.Mutex
}

// NewMetricsPipeline creates a new metrics ingestion pipeline
func NewMetricsPipeline(promClient *EnhancedPrometheusClient, detectorStore DetectorStore) *MetricsPipeline {
	mp := &MetricsPipeline{
		client:        promClient,
		detectorStore: detectorStore,
		collectors:    make(map[string]*MetricCollector),
		transformers:  make(map[string]MetricTransformer),
		scheduler:     NewCollectionScheduler(),
		stopCh:        make(chan struct{}),
	}
	
	// Register default transformers
	mp.RegisterTransformer("standard", &StandardTransformer{})
	mp.RegisterTransformer("avg_5m", &AggregationTransformer{
		WindowSize:    5 * time.Minute,
		AggregateFunc: "avg",
	})
	mp.RegisterTransformer("max_5m", &AggregationTransformer{
		WindowSize:    5 * time.Minute,
		AggregateFunc: "max",
	})
	
	return mp
}

// RegisterTransformer registers a metric transformer
func (mp *MetricsPipeline) RegisterTransformer(name string, transformer MetricTransformer) {
	mp.mu.Lock()
	defer mp.mu.Unlock()
	mp.transformers[name] = transformer
}

// AddCollector adds a new metric collection task
func (mp *MetricsPipeline) AddCollector(collector *MetricCollector) error {
	mp.mu.Lock()
	defer mp.mu.Unlock()
	
	if _, exists := mp.collectors[collector.ID]; exists {
		return fmt.Errorf("collector %s already exists", collector.ID)
	}
	
	// Default transformer if not specified
	if collector.Transformer == nil {
		collector.Transformer = &StandardTransformer{}
	}
	
	mp.collectors[collector.ID] = collector
	mp.scheduler.Schedule(collector.ID, collector.Interval)
	
	return nil
}

// RemoveCollector removes a metric collection task
func (mp *MetricsPipeline) RemoveCollector(collectorID string) {
	mp.mu.Lock()
	defer mp.mu.Unlock()
	
	delete(mp.collectors, collectorID)
	mp.scheduler.Unschedule(collectorID)
}

// Start begins the metrics pipeline
func (mp *MetricsPipeline) Start(ctx context.Context) error {
	mp.wg.Add(1)
	go mp.runScheduler(ctx)
	
	log.Println("Metrics pipeline started")
	return nil
}

// Stop stops the metrics pipeline
func (mp *MetricsPipeline) Stop() {
	close(mp.stopCh)
	mp.wg.Wait()
	log.Println("Metrics pipeline stopped")
}

// runScheduler runs the collection scheduler
func (mp *MetricsPipeline) runScheduler(ctx context.Context) {
	defer mp.wg.Done()
	
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-mp.stopCh:
			return
		case <-ticker.C:
			mp.checkAndRunCollectors(ctx)
		}
	}
}

// checkAndRunCollectors checks which collectors need to run
func (mp *MetricsPipeline) checkAndRunCollectors(ctx context.Context) {
	mp.mu.RLock()
	collectors := make([]*MetricCollector, 0, len(mp.collectors))
	for _, collector := range mp.collectors {
		collectors = append(collectors, collector)
	}
	mp.mu.RUnlock()
	
	now := time.Now()
	for _, collector := range collectors {
		collector.mu.Lock()
		shouldRun := collector.lastRun.IsZero() || now.Sub(collector.lastRun) >= collector.Interval
		if shouldRun {
			collector.lastRun = now
			collector.mu.Unlock()
			
			// Run collection in goroutine
			mp.wg.Add(1)
			go mp.runCollector(ctx, collector)
		} else {
			collector.mu.Unlock()
		}
	}
}

// runCollector executes a single collector
func (mp *MetricsPipeline) runCollector(ctx context.Context, collector *MetricCollector) {
	defer mp.wg.Done()
	
	// Query metrics
	metrics, err := mp.client.Query(ctx, collector.Query)
	if err != nil {
		log.Printf("Error collecting metrics for %s: %v", collector.ID, err)
		return
	}
	
	// Transform metrics
	dataPoints, err := collector.Transformer.Transform(metrics)
	if err != nil {
		log.Printf("Error transforming metrics for %s: %v", collector.ID, err)
		return
	}
	
	// Send to detector
	if collector.DetectorID != "" {
		detInterface, err := mp.detectorStore.Get(collector.DetectorID)
		if err != nil {
			log.Printf("Error getting detector %s: %v", collector.DetectorID, err)
			return
		}
		
		// Type assert to our Detector interface
		det, ok := detInterface.(Detector)
		if !ok {
			log.Printf("Detector %s does not implement required interface", collector.DetectorID)
			return
		}
		
		// Feed data to detector
		for _, point := range dataPoints {
			// Convert DataPoint to format expected by detector
			value := []float64{point.Value}
			
			// Train or detect based on detector state
			if det.GetStatus() == "training" {
				det.Train(value)
			} else if det.GetStatus() == "running" {
				result := det.Detect(value)
				if result.IsAnomaly {
					log.Printf("Anomaly detected by %s: score=%f", collector.DetectorID, result.Score)
					// TODO: Send anomaly event via WebSocket
				}
			}
		}
	}
	
	log.Printf("Collected %d metrics for %s", len(dataPoints), collector.ID)
}

// CreateCollectorForDetector creates a collector based on detector configuration
func (mp *MetricsPipeline) CreateCollectorForDetector(detectorID string, query string, interval time.Duration) error {
	collector := &MetricCollector{
		ID:          fmt.Sprintf("detector_%s", detectorID),
		Query:       query,
		Interval:    interval,
		DetectorID:  detectorID,
		Transformer: &StandardTransformer{},
	}
	
	return mp.AddCollector(collector)
}

// GetCollectorStatus returns the status of all collectors
func (mp *MetricsPipeline) GetCollectorStatus() map[string]CollectorStatus {
	mp.mu.RLock()
	defer mp.mu.RUnlock()
	
	status := make(map[string]CollectorStatus)
	for id, collector := range mp.collectors {
		collector.mu.Lock()
		status[id] = CollectorStatus{
			ID:       collector.ID,
			Query:    collector.Query,
			Interval: collector.Interval,
			LastRun:  collector.lastRun,
			NextRun:  collector.lastRun.Add(collector.Interval),
		}
		collector.mu.Unlock()
	}
	
	return status
}

// CollectorStatus represents the status of a metric collector
type CollectorStatus struct {
	ID       string
	Query    string
	Interval time.Duration
	LastRun  time.Time
	NextRun  time.Time
}

// CollectionScheduler manages collection scheduling
type CollectionScheduler struct {
	schedules map[string]time.Duration
	mu        sync.RWMutex
}

// NewCollectionScheduler creates a new scheduler
func NewCollectionScheduler() *CollectionScheduler {
	return &CollectionScheduler{
		schedules: make(map[string]time.Duration),
	}
}

// Schedule adds a collection schedule
func (cs *CollectionScheduler) Schedule(id string, interval time.Duration) {
	cs.mu.Lock()
	defer cs.mu.Unlock()
	cs.schedules[id] = interval
}

// Unschedule removes a collection schedule
func (cs *CollectionScheduler) Unschedule(id string) {
	cs.mu.Lock()
	defer cs.mu.Unlock()
	delete(cs.schedules, id)
}

// Helper functions for aggregation
func min(values ...float64) float64 {
	if len(values) == 0 {
		return 0
	}
	minVal := values[0]
	for _, v := range values[1:] {
		if v < minVal {
			minVal = v
		}
	}
	return minVal
}

func max(values ...float64) float64 {
	if len(values) == 0 {
		return 0
	}
	maxVal := values[0]
	for _, v := range values[1:] {
		if v > maxVal {
			maxVal = v
		}
	}
	return maxVal
}

func avg(values ...float64) float64 {
	if len(values) == 0 {
		return 0
	}
	return sum(values...) / float64(len(values))
}

func sum(values ...float64) float64 {
	total := 0.0
	for _, v := range values {
		total += v
	}
	return total
} 