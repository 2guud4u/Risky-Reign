import { Resource } from "./hexUtils";
export interface PlayerObj {
    name: string;
    color: string;
    resources: Map<Resource, number>;
}