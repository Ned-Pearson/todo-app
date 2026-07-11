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
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:tasks.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
