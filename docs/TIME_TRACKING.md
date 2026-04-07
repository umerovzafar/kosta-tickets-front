# Учёт времени: фронтенд и API

Запросы идут через **gateway** с тем же базовым URL, что и остальное приложение (см. **`docs/FRONTEND_CONNECTION.md`**). Префикс: **`/api/v1/time-tracking/...`**.

Каноничные описания на бэкенде:

- общая схема путей — `tickets-back/docs/FRONTEND_CONNECTION.md` (§ учёт времени);
- почасовые ставки — `tickets-back/docs/TIME_TRACKING_HOURLY_RATES.md`;
- **проекты по клиентам** (эндпоинты, поля формы, права) — `tickets-back/docs/TIME_TRACKING_FRONTEND.md` (§5.2), подробнее — `tickets-back/docs/FRONTEND_TIME_MANAGER_PROJECTS.md`, модель — `tickets-back/docs/TIME_TRACKING_PROJECTS_DESIGN.md`.

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
| `listTimeManagerClients` / `getTimeManagerClient` | `GET /api/v1/time-tracking/clients`, `GET .../clients/{id}` |
| `createTimeManagerClient` / `patchTimeManagerClient` / `deleteTimeManagerClient` | POST / PATCH / DELETE `.../clients` (DELETE → **204**) |
| `listClientTasks` / `getClientTask` | `GET .../clients/{clientId}/tasks`, `GET .../tasks/{taskId}` |
| `createClientTask` / `patchClientTask` / `deleteClientTask` | POST / PATCH / DELETE `.../clients/{clientId}/tasks/...` (DELETE → **204**) |
| `listClientExpenseCategories` / `getClientExpenseCategory` | `GET .../clients/{clientId}/expense-categories` (query `includeArchived`), одна категория по id |
| `createClientExpenseCategory` / `patchClientExpenseCategory` / `deleteClientExpenseCategory` | POST / PATCH / DELETE `.../expense-categories/...` (DELETE → **204** или **409** если используется) |
| `getClientProjectCodeHint` | `GET .../clients/{clientId}/projects/code-hint` (`last_code`, `suggested_next`) |
| `listClientProjects` / `getClientProject` | `GET .../clients/{clientId}/projects`, `GET .../projects/{projectId}` |
| `createClientProject` / `patchClientProject` / `deleteClientProject` | POST / PATCH / DELETE `.../clients/{clientId}/projects/...` (DELETE → **204** или **409** при записях времени) |

### Клиенты time manager (настройки → вкладка «Клиенты»)

Реализация: **`TimeTrackingClientsPanel`** — список с фильтром, модальное окно создания/редактирования по полям из `tickets-back/docs/TIME_TRACKING_FRONTEND.md` (camelCase в теле запроса). Просмотр списка — роли с правом view на gateway; **изменение** — только роли «Главный администратор», «Администратор», «Партнёр» (см. `timeManagerClientsAccess.ts`).

### Задачи по клиентам (настройки → вкладка «Задачи»)

**`TimeTrackingClientTasksPanel`**: выбор клиента, список **`GET .../clients/{id}/tasks`**, форма «Новая задача» (поля `name`, `defaultBillableRate`, `billableByDefault`, `commonForFutureProjects`, `addToExistingProjects` — см. §5 в `TIME_TRACKING_FRONTEND.md`).

### Категории расходов по клиентам (настройки → вкладка «Категории расходов»)

**`TimeTrackingClientExpenseCategoriesPanel`**: клиент, опция **«Показать архивные»** (`includeArchived`), CRUD по §5.1 `TIME_TRACKING_FRONTEND.md` (`name`, `hasUnitPrice`, `sortOrder`, в PATCH — `isArchived`). Удаление только при `deletable` / нулевом `usage_count`.

### Проекты по клиентам

Справочник проектов привязан к **клиенту** (`clientId` → `GET .../projects`). Поля и соглашения по `project_type`, `budget_type`, `billable_rate_type` — в **`tickets-back/docs/FRONTEND_TIME_MANAGER_PROJECTS.md`**. Связь с записью времени: в теле **`createTimeEntry`** / **`patchTimeEntry`** поле **`projectId`** = UUID проекта.

**Настройки → вкладка «Проекты»:** **`TimeTrackingClientProjectsPanel`** — выбор клиента, список **`listClientProjects`**, создание/редактирование (**`createClientProject`** / **`patchClientProject`**), подсказка кода **`getClientProjectCodeHint`**, удаление при **`deletable`**.

Вкладка **«Проекты»** на главной **`/time-tracking`** (`ProjectsPanel`) пока на моках и не связана с этим API.

### Норма часов в неделю (профиль / карточка пользователя)

- В ответах **`GET /api/v1/users/me`** и **`GET /api/v1/users/{id}`** поле **`weekly_capacity_hours`** (`number | null`): норма из сервиса учёта времени.
- Сам пользователь: **`PATCH /api/v1/users/me/weekly-capacity-hours`** с телом `{"weekly_capacity_hours": N}` (`0 < N ≤ 168`) — функция **`patchMyWeeklyCapacityHours`** в `@entities/user`.
- Админ в карточке другого пользователя: обновление через **`upsertTimeTrackingUser(user, { weeklyCapacityHours: N })`** (тот же `POST /time-tracking/users`).
- Сохранить свою норму можно через **`patchMyWeeklyCapacityHours`** в **`@entities/user`** (при необходимости вызовите из нужного экрана приложения).

## Где уже используется API

- **Админка → карточка пользователя → вкладка «Ставки»** (`UserEditPage`): синхронизация пользователя в TT и CRUD почасовых ставок в БД.
- **Учёт времени → Пользователи** (`TimeUsersPanel`): список из auth + **`listTimeTrackingUsers`** для подстановки **`weekly_capacity_hours`** в колонку ёмкости (если нет в TT — подсказка **35**).
- **Настройки** учёта времени: клиенты, задачи по клиентам, категории расходов по клиентам — см. выше.

## Где пока моки

Страница **`/time-tracking`**: панели **проекты** (UI-заглушка; API проектов клиента уже в **`@entities/time-tracking`**), **расходы**, **расписание**, **отчёты** по-прежнему на заглушках; для реальных данных — `getTeamWorkload`, `listTimeEntries`, **`listClientProjects`** и др. по `tickets-back/docs/TIME_TRACKING_FRONTEND.md`.

## Ошибки

- **503** — не задан `TIME_TRACKING_SERVICE_URL` на gateway или сервис `time_tracking` недоступен.
- **403** — роль не позволяет операцию (ставки `cost` только у админов и т.д. — см. `TIME_TRACKING_HOURLY_RATES.md`).
- **404 «Пользователь не найден»** при ставках — пользователь не синхронизирован в TT; перед ставками вызывается `upsertTimeTrackingUser`.
- **409** при удалении категории расходов — категория в использовании; заархивируйте через PATCH (`isArchived`).
