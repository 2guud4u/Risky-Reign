import { Resource } from "./hexUtils";
import { ResourceCount } from "./gameUtils";
export interface PlayerObj {
    name: string;
    color: string;
    resources: ResourceCount;
}