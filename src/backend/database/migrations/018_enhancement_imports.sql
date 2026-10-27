CREATE TABLE enhancement_imports (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(id) = 64 AND id NOT GLOB '*[^0-9a-f]*'),
  expense_id TEXT REFERENCES manual_expenses(id) ON DELETE SET NULL
) STRICT;
CREATE INDEX enhancement_imports_expense ON enhancement_imports(expense_id);
