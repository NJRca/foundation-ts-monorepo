Prometheus & Grafana provisioning for the Foundation monorepo

This folder contains the monitoring configuration used by the project's Docker Compose setup.

Prometheus

- Config: `prometheus.yml`
- Advertised scrape target for the user service: `user-service:9464`
  - Prometheus job: `user-service`
  - Metrics path: `/metrics`
  - Scrape interval: `10s`

Grafana

- Datasources: `grafana-datasources/datasource.yml` (Prometheus datasource -> `http://prometheus:9090`)
- Dashboards:
  - Directory mounted into the container for provisioning: `./monitoring/grafana-dashboards`
  - Dashboard provisioning config: `monitoring/grafana-dashboards.yml` (points Grafana to the provisioning folder)
  - Included dashboard: `monitoring/grafana-dashboards/user-service-dashboard.json` (UID: `user-service-observability`)

Docker Compose mapping (excerpt)

- `docker-compose.yml` mounts the dashboards and provisioning files into Grafana:
  - `./monitoring/grafana-dashboards:/etc/grafana/provisioning/dashboards:ro`
  - `./monitoring/grafana-dashboards.yml:/etc/grafana/provisioning/dashboards/dashboards.yml:ro`
  - `./monitoring/grafana-datasources:/etc/grafana/provisioning/datasources:ro`

Quick start

1. Start the stack: `docker-compose up --build -d`
2. Open Prometheus UI: http://localhost:9090
3. Verify the `user-service` target is present under Status -> Targets (should show `user-service:9464`)
4. Open Grafana: http://localhost:3000 (admin/admin)
5. The "User Service Observability" dashboard will be provisioned automatically.

Notes

- The service exposes metrics on port `9464` (see `services/user-service` Dockerfile/start scripts).
- If you change the metric port in `docker-compose.yml`, update `prometheus.yml` accordingly.
