use tauri_plugin_sql::{Migration, MigrationKind};

fn main() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "initial schema",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add task descriptions",
            sql: include_str!("../migrations/002_descriptions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add task due dates",
            sql: include_str!("../migrations/003_due_dates.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "add subtasks",
            sql: include_str!("../migrations/004_subtasks.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "add recurring tasks",
            sql: include_str!("../migrations/005_recurrence.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "add tags",
            sql: include_str!("../migrations/006_tags.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "add task priority",
            sql: include_str!("../migrations/007_priority.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "add task attachment",
            sql: include_str!("../migrations/008_attachment.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "add multiple attachments per task",
            sql: include_str!("../migrations/009_attachments.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "add task completed_at",
            sql: include_str!("../migrations/010_completed_at.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "add task sort_order",
            sql: include_str!("../migrations/011_sort_order.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "add task due_time",
            sql: include_str!("../migrations/012_due_time.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "add saved_views",
            sql: include_str!("../migrations/013_saved_views.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "add custom_tabs",
            sql: include_str!("../migrations/014_custom_tabs.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "add task pinned",
            sql: include_str!("../migrations/015_pinned.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 16,
            description: "add task_templates",
            sql: include_str!("../migrations/016_task_templates.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 17,
            description: "add task_dependencies",
            sql: include_str!("../migrations/017_task_dependencies.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 18,
            description: "add recurrence occurrences_remaining",
            sql: include_str!("../migrations/018_recurrence_occurrences.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 19,
            description: "add recurrence weekdays",
            sql: include_str!("../migrations/019_recurrence_weekdays.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 20,
            description: "add task archived",
            sql: include_str!("../migrations/020_archived.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 21,
            description: "add task reminders",
            sql: include_str!("../migrations/021_reminders.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 22,
            description: "add task highlight color",
            sql: include_str!("../migrations/022_highlight_color.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 23,
            description: "add task in_progress",
            sql: include_str!("../migrations/023_in_progress.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 24,
            description: "add task backlog",
            sql: include_str!("../migrations/024_backlog.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 25,
            description: "add custom tab color",
            sql: include_str!("../migrations/025_custom_tab_color.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 26,
            description: "add task trash",
            sql: include_str!("../migrations/026_trash.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 27,
            description: "add task timer",
            sql: include_str!("../migrations/027_timer.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:tasks.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
