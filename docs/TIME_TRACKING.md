# Учёт времени: фронтенд и API

Запросы идут через **gateway** с тем же базовым URL, что и остальное приложение (см. **`docs/FRONTEND_CONNECTION.md`**). Префикс: **`/api/v1/time-tracking/...`**.

Каноничные описания на бэкенде:

- общая схема путей — `tickets-back/docs/FRONTEND_CONNECTION.md` (§ учёт времени);
- почасовые ставки — `tickets-back/docs/TIME_TRACKING_HOURLY_RATES.md`.

## Клиент во фронте

Модуль **`@entities/time-tracking`** (`src/entities/time-tracking/api.ts`) использует **`apiFetch`** и Bearer-токен.

| Функция | Метод и путь |
|---------|----------------|
| `listTimeTrackingUsers()` | `GET /api/v1/time-tracking/users` |
| `getTeamWorkload(from, to, { includeArchived })` | `GET /api/v1/time-tracking/team-workload?from=&to=`; опционально `includeArchived=true` |
| `upsertTimeTrackingUser(user, { weeklyCapacityHours })` | `POST /api/v1/time-tracking/users` (поле `weekly_capacity_hours` только если передано) |
| `deleteTimeTrackingUser(authUserId)` | `DELETE /api/v1/time-tracking/users/{id}` |
| `listTimeEntries(id, from, to)` | `GET /api/v1/time-tracking/users/{id}/time-entries?from=&to=` |
| `createTimeEntry` / `patchTimeEntry` / `deleteTimeEntry` | POST / PATCH / DELETE `.../time-entries` |
| `listHourlyRates(id, kind)` | `GET /api/v1/time-tracking/users/{id}/hourly-rates?kind=billable\|cost` |
| `createHourlyRate` / `patchHourlyRate` / `deleteHourlyRate` | POST / PATCH / DELETE для той же ветки `hourly-rates` |

### Норма часов в неделю (профиль / карточка пользователя)

- В ответах **`GET /api/v1/users/me`** и **`GET /api/v1/users/{id}`** поле **`weekly_capacity_hours`** (`number | null`): норма из сервиса учёта времени.
- Сам пользователь: **`PATCH /api/v1/users/me/weekly-capacity-hours`** с телом `{"weekly_capacity_hours": N}` (`0 < N ≤ 168`) — функция **`patchMyWeeklyCapacityHours`** в `@entities/user`.
- Админ в карточке другого пользователя: обновление через **`upsertTimeTrackingUser(user, { weeklyCapacityHours: N })`** (тот же `POST /time-tracking/users`).

## Где уже используется API

- **Админка → карточка пользователя → вкладка «Ставки»** (`UserEditPage`): синхронизация пользователя в TT и CRUD почасовых ставок в БД.

## Где пока моки

Страница **`/time-tracking`** (панели пользователей, проекты, расходы, расписание, отчёты) пока не вызывает перечисленные API — данные из констант/заглушек. Чтобы подключить реальные данные, подставьте `listTimeTrackingUsers`, `getTeamWorkload` и следующие эндпоинты из gateway в соответствующие панели.

## Ошибки

- **503** — не задан `TIME_TRACKING_SERVICE_URL` на gateway или сервис `time_tracking` недоступен.
- **403** — роль не позволяет операцию (ставки `cost` только у админов и т.д. — см. `TIME_TRACKING_HOURLY_RATES.md`).
- **404 «Пользователь не найден»** при ставках — пользователь не синхронизирован в TT; перед ставками вызывается `upsertTimeTrackingUser`.
