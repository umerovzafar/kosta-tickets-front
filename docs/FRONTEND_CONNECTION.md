# Подключение фронтенда к API (Kosta Tickets)

Каноничная копия для бэкенда — **`tickets-back/docs/FRONTEND_CONNECTION.md`** (если репозиторий в монорепо). Во **tickets-front** этот файл дублирует правила для разработчиков UI.

Фронтенд (**tickets-front**, Vite + React) ходит только в **gateway** — единую точку входа (`/api/v1/...`). Прямые вызовы на порты микросервисов из браузера в проде не используются.

## Базовый URL

- Все маршруты API: префикс **`/api/v1`**.
- Клиент: **`apiFetch`** из `@shared/api` + **`getApiBaseUrl()`** из `@shared/config` (`src/shared/config/env.ts`).

### Пустой `VITE_API_BASE_URL` (локально через прокси)

- **`apiFetch('/api/v1/...')`** → URL вида **`/api/v1/...`** на origin SPA; Vite проксирует **`/api`** на **`VITE_PROXY_TARGET`**.
- **`getAzureLoginUrl` / `getAzureLogoutUrl` / `getAdminLoginUrl`** → относительные пути **`/api/v1/auth/...`** (тот же origin и прокси).
- **`getTicketsWsUrl` / `getNotificationsWsUrl`** → **`ws://`** или **`wss://`** на **`window.location.host`** + путь **`/api/v1/.../ws...`** (прокси должен пробрасывать WebSocket, если фича используется).

## Локальная разработка

1. Запустите **gateway** из **tickets-back** (например `http://127.0.0.1:1234`).
2. В корне **tickets-front** создайте `.env` или `.env.local` по образцу **`.env.example`**:
   - задайте **`VITE_PROXY_TARGET=http://127.0.0.1:1234`** (или фактический адрес gateway);
   - **не задавайте** `VITE_API_BASE_URL` (или оставьте пустым).
3. При пустом `VITE_API_BASE_URL` запросы идут на тот же origin, что и страница (`localhost:5173`), а Vite проксирует **`/api`** на `VITE_PROXY_TARGET` (`vite.config.ts`).

Если видите **503** на **любых** путях API — сначала проверьте, что gateway запущен и верный **`VITE_PROXY_TARGET`** (локально) или **`VITE_API_BASE_URL`** (прод).

Отдельный случай: **503 только на** **`/api/v1/todos/...`** (например доска или календарь) при живом gateway — это **не баг фронтенда**, а то, что gateway не достучался до микросервиса **todos**. Подробности — в подразделе **«503 на /api/v1/todos»** ниже на этой странице.

## Продакшен / отдельный домен API

В сборке задайте:

```env
VITE_API_BASE_URL=https://ticketsback.kostalegal.com
```

Только **origin**, без `/api/v1`. Тогда `apiFetch('/api/v1/...')` уйдёт на полный URL.

## Авторизация и CORS

- Токен: **`getAccessToken()`** → заголовок **`Authorization: Bearer`** (ставит `apiFetch`).
- При **401** возможен редирект на логин — см. `src/shared/api/client.ts`.
- CORS настраивается на gateway (**`FRONTEND_URL`** и др. в env контейнера gateway) — см. tickets-back `.env.example`.

## Учёт времени (примеры путей)

| Назначение | Путь |
|------------|------|
| Загрузка команды | `GET /api/v1/time-tracking/team-workload?from=…&to=…` |
| Пользователи TT | `GET /api/v1/time-tracking/users` |
| Почасовые ставки | `GET /api/v1/time-tracking/users/{id}/hourly-rates?kind=billable` и т.д. |

Подробности и обёртки в коде: **`docs/TIME_TRACKING.md`**.

## Список дел (todos / Kanban + Outlook)

Все запросы через **`apiFetch('/api/v1/todos/...')`** на gateway (локально — тот же Vite-прокси, что и для остального API). Каноничное описание эндпоинтов и тел запросов: **`tickets-back/docs/FRONTEND_TODOS.md`**.

В коде: `src/pages/todo/api/boardApi.ts` (доска, колонки, карточки), `src/pages/todo/services/calendarApi.ts` (подключение календаря, события).

### 503 на `/api/v1/todos` и календарь

Запросы вроде **`GET .../api/v1/todos/board`** или **`GET .../api/v1/todos/calendar/status`** с ответом **503** означают: **gateway не получил корректный ответ от сервиса todos** (или не настроен прокси на него). Это **инфраструктура и конфигурация на сервере**, а не ошибка SPA.

В коде gateway различают два случая:

| Ситуация | Типичное сообщение в ответе |
|----------|----------------------------|
| Переменная **`TODOS_SERVICE_URL` не задана** (пустая в env gateway) | текст вида **`TODOS_SERVICE_URL not configured`** |
| URL задан, но **нет TCP/соединения** (сервис выключен, неверный хост/порт, другая сеть) | текст вида **`Todos service unavailable`** |

**Что сделать на сервере** (Portainer, Docker Compose, Kubernetes и т.п.):

1. Убедиться, что контейнер или под **todos** **запущен** и слушает порт **1240** (как в образе/compose репозитория **tickets-back**).
2. У **gateway** в переменных окружения задать **`TODOS_SERVICE_URL`**. В Docker Compose обычно: **`http://todos:1240`** (имя сервиса — как в вашем stack; в Kubernetes — свой внутренний URL сервиса и порт).
3. **Перезапустить gateway** после изменения env.
4. Проверить доступность с хоста сети или **из контейнера gateway**, например: **`GET http://todos:1240/health`** (или эквивалент для вашего имени сервиса).
5. Если сервис **todos** на прод ещё **не деплоили** или **не добавили в stack** — его нужно выкатить и подключить; иначе gateway будет стабильно отдавать **503** на эти пути.

Расширенное описание (gateway, медиа, БД): репозиторий **tickets-back**, файл **`docs/TODOS.md`**, раздел **«Gateway»** (в т.ч. подраздел про 503 на проде).

## Проверка

1. `GET` health gateway, например `http://127.0.0.1:1234/health`.
2. С фронта с токеном: `GET /api/v1/users/me`.
3. При **503 только на todos**: с инфраструктуры — `GET` health сервиса todos (например `http://todos:1240/health` из сети Docker) и проверка **`TODOS_SERVICE_URL`** у gateway — см. подраздел выше.

## Шпаргалка переменных

| Переменная | Когда |
|------------|--------|
| `VITE_PROXY_TARGET` | Локально, dev + прокси Vite |
| `VITE_API_BASE_URL` | Прод или API на другом origin без прокси |
| `VITE_ATTENDANCE_API_BASE` | Только если нужен отдельный base для посещаемости |
