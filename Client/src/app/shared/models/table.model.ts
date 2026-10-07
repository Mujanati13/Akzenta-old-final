export interface TableData {
  id: number;
  name: string;
  description: string;
  // Add more fields as necessary
}

export interface NestedTableData {
  parentId: number;
  parentName: string;
  children: ChildData[];
}

export interface ChildData {
  id: number;
  name: string;
  description: string;
}
