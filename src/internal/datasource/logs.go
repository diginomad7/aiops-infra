package datasource

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"syscall"
	"time"
)

// LogSource implements data collection from log files
type LogSource struct {
	name          string
	path          string
	pattern       *regexp.Regexp
	valueRegex    *regexp.Regexp
	timestampFmt  string
	labelRegex    map[string]*regexp.Regexp
	rotationCheck bool
	lastPosition  int64
	lastInode     uint64
}

// NewLogSource creates a new log data source
func NewLogSource(config *Config) (*LogSource, error) {
	if config.Type != TypeLogs {
		return nil, fmt.Errorf("invalid source type: %s", config.Type)
	}

	pattern, err := regexp.Compile(config.LogPattern)
	if err != nil {
		return nil, fmt.Errorf("invalid log pattern: %w", err)
	}

	valueRegex, err := regexp.Compile(config.ValueExtract)
	if err != nil {
		return nil, fmt.Errorf("invalid value extraction pattern: %w", err)
	}

	labelRegex := make(map[string]*regexp.Regexp)
	for label, pattern := range config.LabelExtract {
		re, err := regexp.Compile(pattern)
		if err != nil {
			return nil, fmt.Errorf("invalid label pattern for %s: %w", label, err)
		}
		labelRegex[label] = re
	}

	return &LogSource{
		name:          config.Name,
		path:          config.LogPath,
		pattern:       pattern,
		valueRegex:    valueRegex,
		timestampFmt:  config.TimestampFmt,
		labelRegex:    labelRegex,
		rotationCheck: config.RotationCheck,
	}, nil
}

// Name returns the name of the data source
func (s *LogSource) Name() string {
	return s.name
}

// Type returns the type of the data source
func (s *LogSource) Type() SourceType {
	return TypeLogs
}

// Collect retrieves data points from log file
func (s *LogSource) Collect(ctx context.Context) ([]DataPoint, error) {
	file, err := os.Open(s.path)
	if err != nil {
		return nil, fmt.Errorf("error opening log file: %w", err)
	}
	defer file.Close()

	// Check for log rotation if enabled
	if s.rotationCheck {
		stat, err := file.Stat()
		if err != nil {
			return nil, fmt.Errorf("error getting file stats: %w", err)
		}

		// Get inode number on Unix systems
		if stat, ok := stat.Sys().(*syscall.Stat_t); ok {
			if s.lastInode > 0 && stat.Ino != s.lastInode {
				// Log has been rotated, reset position
				s.lastPosition = 0
			}
			s.lastInode = stat.Ino
		}

		// Check if file has been truncated
		if stat.Size() < s.lastPosition {
			s.lastPosition = 0
		}
	}

	// Seek to last position
	if s.lastPosition > 0 {
		if _, err := file.Seek(s.lastPosition, 0); err != nil {
			return nil, fmt.Errorf("error seeking in file: %w", err)
		}
	}

	var points []DataPoint
	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return points, ctx.Err()
		default:
			line := scanner.Text()
			if !s.pattern.MatchString(line) {
				continue
			}

			// Extract timestamp
			var timestamp time.Time
			if s.timestampFmt != "" {
				ts := s.pattern.FindStringSubmatch(line)[1] // Assuming first group is timestamp
				timestamp, err = time.Parse(s.timestampFmt, ts)
				if err != nil {
					continue // Skip line if timestamp parsing fails
				}
			} else {
				timestamp = time.Now()
			}

			// Extract value
			valueMatch := s.valueRegex.FindStringSubmatch(line)
			if len(valueMatch) < 2 {
				continue
			}
			value, err := strconv.ParseFloat(valueMatch[1], 64)
			if err != nil {
				continue
			}

			// Extract labels
			labels := make(map[string]string)
			for label, regex := range s.labelRegex {
				if match := regex.FindStringSubmatch(line); len(match) > 1 {
					labels[label] = match[1]
				}
			}

			points = append(points, DataPoint{
				Timestamp: timestamp,
				Value:     value,
				Labels:    labels,
			})
		}
	}

	if err := scanner.Err(); err != nil {
		return points, fmt.Errorf("error scanning log file: %w", err)
	}

	// Update last position
	if s.rotationCheck {
		pos, err := file.Seek(0, 1) // Get current position
		if err == nil {
			s.lastPosition = pos
		}
	}

	return points, nil
}

// Close releases any resources used by the data source
func (s *LogSource) Close() error {
	return nil
}
