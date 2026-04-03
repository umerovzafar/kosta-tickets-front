# Подключение фронтенда к модулю «Расходы»

> **Каноническая версия** этого документа — в репозитории бэкенда: `tickets-back/docs/expenses-frontend.md`. При расхождениях правьте сначала там, затем синхронизируйте этот файл.

Фронтенд **не** обращается к микросервису `expenses` напрямую (порт 1242 доступен только внутри Docker-сети). Все запросы идут через **gateway** по публичному URL API.

---

## 1. Архитектура

```
Браузер (SPA)  →  https://<ваш-api-домен>  →  gateway :1234  →  http://expenses:1242
```

- Базовый путь API на gateway: **`/api/v1`**
- Расходы: **`/api/v1/expenses`**, справочники: **`/api/v1/expense-types`**, **`/api/v1/projects`**, **`/api/v1/exchange-rates?date=YYYY-MM-DD`** (и др. — см. `gateway/presentation/routes/expenses_routes.py` в tickets-back)

---

## 2. Переменные окружения бэкенда (gateway)

В `.env` репозитория `tickets-back` для gateway должны быть согласованы с тем, откуда открывается SPA:

| Переменная | Назначение |
|------------|------------|
| **`GATEWAY_BASE_URL`** | Публичный URL API (OAuth redirect, ссылки). Прод: `https://ticketsback.kostalegal.com` |
| **`FRONTEND_URL`** | Origin SPA для **CORS**. Прод: `https://tickets.kostalegal.com` |
| **`EXPENSES_SERVICE_URL`** | Внутри Docker: `http://expenses:1242` (не подставлять в фронт) |

Часто **`FRONTEND_URL`** и **`GATEWAY_BASE_URL`** на gateway **совпадают** с переменными в env контейнера **`expenses`** (письма, ссылки из почты).

После изменения `.env` перезапустите gateway: `docker compose up -d gateway`.

Если CORS блокирует запросы — проверьте, что **`FRONTEND_URL`** точно совпадает с origin в браузере (схема, хост, порт, без лишнего слэша).

---

## 3. Настройка фронтенда (Vite / env)

**Вариант A — прямой URL API** (удобно без прокси):

В `.env` фронта (или `.env.production`):

```env
VITE_API_URL=https://ticketsback.kostalegal.com
```

В коде запросов использовать этот base URL + пути `/api/v1/expenses`, …

**Вариант B — прокси в `vite.config`**: запросы с dev-сервера идут на `http://127.0.0.1:1234`, в браузере остаётся `localhost:5173` — см. комментарии в `.env.example` бэкенда (`vite.config.example.ts` в корне монорепо, если есть).

---

## 4. Авторизация

Все эндпоинты расходов на gateway **требуют** заголовок:

```http
Authorization: Bearer <access_token>
```

Токен тот же, что для остального приложения (вход через Azure AD / ваш auth). Без токена — **401**.

**Без Bearer (публичные GET через gateway):** **`/api/v1/expenses/{id}/email-action?token=...`** (согласование из письма; при **`EXPENSE_EMAIL_ACTION_CONFIRM_STEP`** в ссылке из письма добавляется **`confirm=1`** — сначала экран подтверждения) и **`/api/v1/expenses/{id}/attachments/{attachment_id}/email-file?token=...`** (файл по токену). Остальные маршруты **`/api/v1/expenses/...`** требуют заголовок `Authorization`.

---

## 5. Примеры URL (production)

Если API: `https://ticketsback.kostalegal.com`:

- Список: `GET https://ticketsback.kostalegal.com/api/v1/expenses?skip=0&limit=50`
- Создание: `POST https://ticketsback.kostalegal.com/api/v1/expenses`
- Типы: `GET https://ticketsback.kostalegal.com/api/v1/expense-types`
- Курс: `GET https://ticketsback.kostalegal.com/api/v1/exchange-rates?date=2026-04-02`

Контракт полей (camelCase / деньги) согласован с ТЗ и нормализацией на фронте (`coerceExpense.ts`, `expenseAuthor.ts` и **[TZ-expenses-backend.md](../TZ-expenses-backend.md)** в этом репозитории).

### Автор заявки

В ответах списка и карточки заявки бэкенд отдаёт **`createdBy`** (объект):

- `id` — тот же смысл, что и `createdByUserId`
- `displayName`, `email`, опционально `picture`, `position` — из auth (`GET /users/{id}` тем же Bearer-токеном)

Если auth недоступен или профиль не найден, объект всё равно приходит: заполняется **`id`**, остальные поля могут быть `null`. На странице расходов автор показывается в **карточках** списка заявок, в боковой панели заявки и в Excel-отчёте.

### Почта модераторам

Письма шлёт микросервис **`expenses`**. **Каноничная таблица и все переменные** — **`tickets-back/docs/expenses-frontend.md`** (§5 → «Почта модераторам»). Кратко:

- Письмо **только** при **`POST .../expenses/{id}/submit`**, не при черновике.
- SMTP: **`EXPENSE_SMTP_*`** (или **`SMTP_*`**), **`EXPENSE_NOTIFY_TO`**, **`EXPENSE_MAIL_FROM`**; ссылки: **`FRONTEND_URL`** или **`EXPENSES_FRONTEND_URL`**, шаблон **`EXPENSE_NOTIFY_LINK_TEMPLATE`**.
- Одноразовые действия: публичный API **`GATEWAY_BASE_URL`** / **`PUBLIC_API_BASE_URL`** / **`EXPENSES_PUBLIC_API_BASE_URL`** + **`EXPENSE_EMAIL_ACTION_SECRET`**; **`EXPENSE_EMAIL_ACTION_CONFIRM_STEP`** (по умолчанию двухшаговое подтверждение в браузере); **`EXPENSE_EMAIL_ACTION_TTL_SECONDS`**.
- Ссылка на файл из письма: **`GET .../attachments/{id}/email-file?token=...`** (без Bearer).
- Без одноразовых ссылок — параметр **`intent`** (`approve` / `reject`) на фронт; после входа в SPA должен открываться маршрут **`/expenses/{id}`** (в `tickets-front` реализовано: панель заявки + обработка **`intent`**).
- Если из письма открывается только список и «ничего не происходит» — проверьте **`EXPENSE_NOTIFY_LINK_TEMPLATE`** и роутер (нужен путь **`/expenses/:expenseId`**). Подробнее — **`tickets-back/docs/expenses-frontend.md`**.

---

## 6. Вложения: квитанция на оплату и чек оплаты

Для **возмещаемых** заявок в API два типа файлов — в `POST /api/v1/expenses/{id}/attachments` передаётся поле формы **`attachmentKind`** (`multipart/form-data`).

**Порядок по бизнес-правилам (и для UI):**

1. **Сначала** — **квитанция на оплату** (документ **для** оплаты: счёт, накладная и т.п.). В API: **`attachmentKind=payment_document`**. В форме фронта — «Документ для оплаты».
2. **Затем** — **чек оплаты** (подтверждение **факта** оплаты). В API: **`attachmentKind=payment_receipt`**. В форме фронта — «Квитанция об оплате».

Допустимые значения: только `payment_document` и `payment_receipt`. В ответах: **`paymentDocumentUploaded`**, **`paymentReceiptUploaded`**.

При отправке на согласование для возмещаемой заявки, если уже используются типизированные вложения, **нужны оба типа**. Сообщение бэкенда: *«Для возмещаемого расхода нужны оба вложения: документ для оплаты и квитанция об оплате»* — см. `validate_submit_fields` в `tickets-back/expenses/application/expense_service.py`. Без типов достаточно одного вложения (legacy). Порядок на сервере не навязывается, в продукте и UI — **сначала документ на оплату, потом чек оплаты**.

---

## 7. Дата расхода и курсы ЦБ (форма SPA)

В API поле **`expenseDate`** (YYYY-MM-DD) обязательно. На фронте при **создании** заявки поля выбора даты нет: уходит **текущий день** по локальному времени; перед сохранением дата пересчитывается. Курс UZS/USD и кросс-курсы — с **cbu.uz** на эту дату (`cbuRates.ts`). В **edit/view** дата только для чтения.

**Dev:** proxy **`/cbu-json`** → `https://cbu.uz` в `vite.config`. **Prod:** при CORS — **`VITE_CBU_ORIGIN`** на прокси того же origin (см. комментарии в `src/pages/expenses/model/cbuRates.ts`).

---

## 8. Частые проблемы

| Симптом | Что проверить |
|---------|---------------|
| CORS error | `FRONTEND_URL` на gateway, совпадение origin с SPA |
| 503 на `/api/v1/expenses` | Контейнер `expenses` запущен, `EXPENSES_SERVICE_URL` в env gateway |
| **500** на `/api/v1/expenses` | Логи `docker compose logs expenses --tail 100`; часто не хватает колонки в БД после обновления — пересоберите и перезапустите `expenses`. |
| Нет писем модераторам после submit | Env **`EXPENSE_SMTP_*`**, **`EXPENSE_NOTIFY_TO`** на контейнере **`expenses`**; логи `expense notify:`. См. **`tickets-back/docs/expenses-frontend.md`**. |
| Ссылка из письма на фронт не открывает заявку | URL должен быть вида **`/expenses/{id}`** (как в шаблоне по умолчанию). См. §5 в **`tickets-back/docs/expenses-frontend.md`**. |
| 401 | Передаётся ли `Authorization`, не истёк ли токен |
| 403 | Роль пользователя (раздел расходов / модерация) |

---

## 9. Локальная разработка

- Gateway: `http://localhost:1234` (или порт из `GATEWAY_PORT`).
- Фронт: `http://localhost:5173` — укажите этот origin в `FRONTEND_URL` на бэкенде.
- Микросервисы поднимайте через `docker compose up` или укажите в gateway `EXPENSES_SERVICE_URL=http://host.docker.internal:1242`, если `expenses` запущен на хосте.

---

*См. также: деплой и переменные БД — в общей документации стека tickets-back (`docker-compose.yml`, `.env.example`).*
