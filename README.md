# AIOps Infrastructure

Проект для развертывания отказоустойчивого Kubernetes кластера на базе K3s с мониторингом.

## Требования

- VirtualBox
- Vagrant
- Ansible
- Helm

## Архитектура

- 2 мастер-ноды K3s для отказоустойчивости
- 1 рабочая нода
- NGINX Ingress Controller
- Prometheus + Grafana для мониторинга
- Flannel CNI в режиме vxlan

## Быстрый старт

1. Запустить виртуальные машины:
```bash
vagrant up
```

2. Установить K3s кластер:
```bash
cd ansible
ansible-playbook -i inventory.ini k3s-install.yml
```

3. Установить мониторинг:
```bash
ansible-playbook -i inventory.ini monitoring.yml
```

4. Добавить в /etc/hosts:
```
192.168.56.11 grafana.local
```

5. Доступ к Grafana:
- URL: http://grafana.local
- Логин: admin
- Пароль: admin123

## Безопасность

- Отключен root доступ по SSH
- Отключена аутентификация по паролю
- Настроен минимальный набор прав для компонентов
- Используется TLS для всех компонентов
- Настроен NGINX Ingress с возможностью добавления TLS

## Мониторинг

- Prometheus для сбора метрик
- Grafana для визуализации
- Node Exporter для системных метрик
- kube-state-metrics для метрик Kubernetes

## Масштабирование

Для добавления новых рабочих нод:
1. Добавить новую ноду в Vagrantfile
2. Добавить ноду в inventory.ini
3. Запустить плейбук k3s-install.yml 