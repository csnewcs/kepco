# KEPCO API

KEPCO 스마트 사용량 데이터를 조회하고 Prometheus 메트릭으로 노출하는 NestJS 서비스입니다.

## Requirements

- Node.js 22+
- pnpm
- KEPCO 계정

## Environment

`.env`에 아래 값을 설정합니다.

```env
KEPCO_ID=
KEPCO_PW=
PORT=3000
HOST=127.0.0.1
CORS=
```

기본 예시는 [.env.example](.env.example)에 있습니다.

기본 리슨 주소는 `127.0.0.1`이며, `HOST`가 비어 있어도 같은 기본값을 사용합니다.
`/api/kepco/*`와 `/metrics`는 인증 없이 개인 전력 사용량·요금을 제공하므로 신뢰하는 내부 환경에서만 접근하도록 구성합니다.
외부 접근이 필요하면 인증을 적용한 리버스 프록시를 사용하고, 애플리케이션 포트를 직접 공개하지 않습니다.

CORS는 기본적으로 비활성화합니다. 브라우저 접근이 필요할 때만 `CORS=https://dashboard.example.com,https://admin.example.com`처럼 정확한 Origin을 쉼표로 구분해 지정합니다.
빈 항목과 `*`는 허용 목록에서 제외하며, credential 허용 헤더는 보내지 않습니다. CORS는 API 인증이나 네트워크 접근 제한을 대신하지 않습니다.

## Install

```bash
pnpm install
```

## Run

```bash
pnpm run start:dev
```

프로덕션 빌드 실행:

```bash
pnpm run build
pnpm run start:prod
```

## Docker

이미지 빌드:

```bash
docker build -t kepco-api .
```

컨테이너 실행:

```bash
docker run --rm \
  -p 127.0.0.1:3000:3000 \
  -e KEPCO_ID=your-id \
  -e KEPCO_PW=your-password \
  -e HOST=0.0.0.0 \
  kepco-api
```

브리지 네트워크 컨테이너는 `HOST=0.0.0.0`으로 컨테이너 인터페이스에 리슨하고, 호스트의 포트는 `127.0.0.1`에만 게시합니다.
호스트 네트워크(`--network host`)를 사용하면 `HOST`의 기본값인 `127.0.0.1`을 유지합니다.
별도 컨테이너의 Prometheus에서 수집한다면 신뢰하는 전용 Docker 네트워크에 연결하고 호스트 포트 게시를 생략합니다.

컨테이너가 올라오면 아래 엔드포인트를 사용할 수 있습니다.

- `http://localhost:3000/api/kepco/usage`
- `http://localhost:3000/metrics`

## HTTP API

애플리케이션 API는 `/api` prefix 아래에 있습니다.

- `GET /api/kepco/usage`
  - 현재 시간 기준 사용량/요금 요약 조회
- `GET /api/kepco/usage/chart?period=time|day|month|year`
  - 구간별 사용량 차트 조회

## Metrics

Prometheus scrape endpoint는 `/metrics` 입니다.

- `/metrics`는 `/api` prefix 밖에 있습니다.
- 서비스 시작 시 즉시 한 번 비동기로 조회합니다.
- 이후 1분마다 KEPCO 사용량/요금 데이터를 다시 조회해 메트릭을 갱신합니다.
- 갱신 실패 시 마지막 정상값을 유지합니다.

기본 Node/process 메트릭(`process_*`, `nodejs_*`)과 함께 아래 KEPCO 메트릭을 노출합니다.

### Usage

- `kepco_usage_realtime_kwh`
- `kepco_usage_predicted_kwh`
- `kepco_usage_current_tier`
- `kepco_usage_predicted_tier`

### Billing

- `kepco_billing_demand_kw`
- `kepco_billing_base_charge_amount`
- `kepco_billing_energy_charge`
- `kepco_billing_realtime_energy_charge`
- `kepco_billing_subtotal_charge`
- `kepco_billing_vat_charge`
- `kepco_billing_fund_charge`
- `kepco_billing_realtime_total_charge`

### Predicted

- `kepco_predicted_charge`
- `kepco_predicted_subtotal_charge`
- `kepco_predicted_realtime_subtotal_charge`
- `kepco_predicted_base_charge`
- `kepco_predicted_vat_charge`
- `kepco_predicted_fund_charge`
- `kepco_predicted_total_charge`

## Verify

```bash
pnpm run lint
pnpm exec jest --runInBand
pnpm run build
pnpm audit --prod
```
