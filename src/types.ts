export interface Task {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  parentId: number | null;
  completed: boolean;
  createdAt: string;
}
