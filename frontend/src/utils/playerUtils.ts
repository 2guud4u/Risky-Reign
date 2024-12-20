import { Resource } from "./hexUtils";
export interface PlayerObj {
    id: number;
    name: string;
    color: string;
    resources: Map<Resource, number>;
}