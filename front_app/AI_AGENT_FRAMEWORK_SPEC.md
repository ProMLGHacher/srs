# Спецификация для ИИ-агента: разработка на фреймворке **kvt**

**Назначение:** этот файл даёт нейросети единые правила и шаблоны, чтобы при запросе вроде «сделай новый бизнес-проект / фичу на нашем фреймворке» код **соблюдал архитектуру kvt**, а не generic React.

**Область:** приложения на базе монорепо **kvt** — пакеты `@kvt/runtime`, `@kvt/react`, `@kvt/vite-plugin`, опционально `@kvt/theme`, `@kvt/ui`, `@kvt/logging`, шаблон **`create-kvt-app`**, CLI **`@kvt/cli`**.

---

## 1. Что такое kvt (кратко)

- **Вертикальные фичи** под `src/features/<имя>/` с разделением слоёв.
- **DI** с **пространствами имён** (`nameSpace`, `nameSpaceDependencies`), регистрация в `*.di.ts`, автозагрузка через `@kvt/di-autoload`.
- **MVVM:** экраны React вызывают методы **ViewModel**; состояние UI — **`StateFlow`**; разовые события (навигация, тосты) — **`Flow`** + **`useFlow`**.
- **Чистая доменная логика** в `domain` без React и без импортов из `data` / `presentation`.

Полная архитектура в репозитории: [ARCHITECTURE.md](../ARCHITECTURE.md).

---

## 2. Обязательная структура фичи

Путь: `src/features/<feature_name>/`

| Каталог | Содержимое |
|---------|------------|
| `domain/` | Сущности, **use case** (`*UseCase.ts`), **абстрактные** репозитории и политики (`*Repository.ts`, `*Policy.ts`). Без React. |
| `data/` | `*RepositoryImpl.ts`, API-клиенты, маппинг DTO → domain. |
| `presentation/` | Страницы/вью (`view/`), **ViewModel** (`view_model/`), модели состояния и UI-событий (`model/`), **`FeatureName.router.tsx`**. |
| `di/` | **`FeatureNameModule.di.ts`** — `DiModule.register` для этой фичи. |

Имя файла модуля: как в шаблоне — `<PascalFeature>Module.di.ts` (например `CounterModule.di.ts`).

**Корень приложения** (не фича): `src/app/` — bootstrap, `App.tsx`, общий роутер, layout, корневой `AppModule.di.ts`.

---

## 3. Правила слоёв и импортов (критично)

1. **`domain`** не импортирует `data`, `presentation`, React, `@kvt/react`.
2. **`data`** может зависеть от контрактов из своего `domain` и внешних библиотек.
3. **`presentation`** импортирует свой `domain` (use case, типы, контракты), **другие фичи — только через их `domain`** (use case / политика / типы), **не** через чужой `data`.
4. **Запрещено:** из `domain` или `presentation` одной фичи тянуть `*Impl` из `data` другой фичи. Зависимость между фичами оформлять через **DI + use case / контракт** и **`nameSpaceDependencies`** в модуле.

При включённом **`archLint`** в `kvt({ archLint: true })` нарушения импортов должны ловиться на сборке.

---

## 4. DI: модули и порядок регистрации

- Каждая фича регистрируется в **`DiModule.register({ nameSpace, nameSpaceDependencies, builder })`**.
- В `builder` вызывают `b.register({ token, implementation, isSingleton?, lazy? })`.
- **Репозитории** с общим жизненным циклом часто `isSingleton: true`.
- **Use case** обычно `lazy: true` (как в шаблоне).
- Зависимость фичи A от фичи B: в модуле A указать `nameSpaceDependencies: [..., "b_name_space"]` и внедрять только **классы из `domain` B** (use case, интерфейс политики), не `*Impl`.

Корневой модуль приложения (`app`) агрегирует фичи через `nameSpaceDependencies`.

**Важно:** runtime **не сканирует** `src` сам. Обязателен импорт **`import "@kvt/di-autoload"`** до создания объектов из контейнера (см. bootstrap).

---

## 5. Use case

- Класс `XxxUseCase` в `domain/use_case/`.
- Зависимости через **`@Inject(Token)`** в конструкторе (токен = класс репозитория или другого use case).
- Публичный метод **`execute(...)`** (или узкий набор методов с явной семантикой).
- Вся оркестрация домена здесь; ViewModel **не** содержит бизнес-правил, которые должны жить в domain.

---

## 6. Репозиторий

- В **`domain/repository/`** — **абстрактный класс** с контрактом (методы + при необходимости `Flow` для подписок).
- В **`data/repository/`** — **`*RepositoryImpl`** extends абстрактный репозиторий.
- В DI: `token: CounterRepository`, `implementation: CounterRepositoryImpl`.

Так UI и use case зависят от абстракции, а не от инфраструктуры.

---

## 7. ViewModel и реактивность

- ViewModel **реализует** `ViewModel<State, UiEvent>` из `@kvt/runtime` (поля `state`, `init`, `uiEvent` — по необходимости).
- Состояние экрана: **`MutableStateFlow`** / **`asStateFlow()`** для readonly снаружи.
- Побочные «сигналы» для UI (одноразовые): **`MutableFlow`** + типизированные **`UIEvent`** (например через фабрики в `*PageUiEvent.ts`).
- В **`init`**: подписки на `Flow` репозиториев/политик, синхронизация начального state; возвращать **cleanup** `() => void` для отписки.

**Паттерн экрана:**

- Данные для отрисовки: **`useStateFlow(vm.state)`**.
- Реакция на события ViewModel: **`useFlow(handler, vm.uiEvent)`**.
- Создание ViewModel: **`useViewModel(FeatureViewModel)`** из `@kvt/react`.

Опционально для тестов: компонент принимает второй аргумент-класс VM (как в шаблоне `CounterDemoPage`).

---

## 8. Presentation: модели

- **`*State.ts`** — тип состояния UI (plain object для `StateFlow`).
- **`*UiEvent.ts`** — дискриминант по `type`, `payload` при необходимости; согласован с `useFlow`.

---

## 9. Маршрутизация (React Router)

- У каждой фичи файл **`presentation/<Feature>.router.tsx`**, экспорт массива **`RouteObject[]`** (с `satisfies RouteObject[]`).
- Корневой **`AppRouter`** в `app/presentation/router/`: `createBrowserRouter`, объединение `children` из фич, общий **`RootLayout`** с `<Outlet />`.
- Пути согласовать с **`NavLink`** в layout.

---

## 10. Bootstrap и Vite

**Порядок в точке входа (например `bootstrap.tsx`):**

1. `import "reflect-metadata"` (если не внедряет плагин — см. ARCHITECTURE.md).
2. `import "@kvt/di-autoload"`.
3. Остальное (ReactDOM, `App`, стили).

**`vite.config.ts`:** плагин **`kvt()`** из `@kvt/vite-plugin` подключать **до** `react()`. Алиас `@` → `src` — как в шаблоне.

Файл **`.kvt/di-autoload.ts`** генерируется плагином; копия в репозитории нужна для **`tsc` без Vite**.

---

## 11. CLI (генерация скелета)

Из проекта с зависимостью `@kvt/cli`:

```bash
pnpm exec kvt generate feature <имя>
pnpm exec kvt generate use-case <фича> <Имя>
pnpm exec kvt generate repository <фича> <Сущность>
```

После генерации **дополнить:** регистрацию в `*.di.ts`, роутер, зависимости модулей, навигацию.

---

## 12. UI и тема

- **`@kvt/theme`:** обёртка приложения в **`KvtThemeProvider`**, семантические цвета через **CSS variables** (`var(--kvt-color-…)`), компоненты `Text`, `Surface`, `Stack` по необходимости. Подробности: `packages/theme/README.md`.
- **`@kvt/ui`:** примитивы `Button`, `Input` + Tailwind в приложении.
- Не смешивать произвольные hex-темы там, где проект уже на Kvt-токенах — выдерживать единый визуальный контракт.

---

## 13. Логирование

- **`@kvt/logging`:** `Logger`, транспорты; использовать в `data` и при необходимости в use case, не тащить логгер в чистые сущности без нужды.

---

## 14. Чеклист: новая бизнес-фича

1. Создать дерево `domain` / `data` / `presentation` / `di` (или `kvt generate feature`).
2. Описать контракты в `domain`, use case-ы, impl в `data`.
3. Зарегистрировать всё в **`*Module.di.ts`**, выставить **`nameSpace`** и **`nameSpaceDependencies`**.
4. Добавить **ViewModel** + state/uiEvent модели + **страницы**.
5. Экспортировать маршруты в **`*router.tsx`**, подключить в **`AppRouter`**.
6. Обновить **`AppModule.di.ts`** или корневые зависимости, если фича в графе приложения.
7. Проверить импорты слоёв и при возможности **`archLint: true`**.

---

## 15. Антипаттерны (не делать)

- Бизнес-логика только в React-компонентах без use case.
- Прямой импорт **`RepositoryImpl`** из другой фичи или в `domain`.
- Регистрация DI без модуля / дублирующие токены без понимания singleton/lazy.
- Пропуск **`@kvt/di-autoload`** перед использованием **`DIContainer` / `useViewModel`**.
- Обход ViewModel через глобальные синглтоны для состояния экрана без веской причины.

---

## 16. Сводка пакетов

| Пакет | Роль для агента |
|--------|-----------------|
| `@kvt/runtime` | `DIContainer`, `DiModule`, `@Inject`, `Flow` / `StateFlow`, `ViewModel`, `Clearable` |
| `@kvt/react` | `useViewModel`, `useStateFlow`, `useFlow` |
| `@kvt/vite-plugin` | `kvt()`, DI autoload, опционально `archLint` |
| `@kvt/cli` | генерация фич / use case / repository |
| `@kvt/theme`, `@kvt/ui` | тема и примитивы UI |
| `@kvt/logging` | логирование |

---

*Документ предназначен для включения в контекст ИИ-агента при разработке или расширении продуктов на kvt.*
