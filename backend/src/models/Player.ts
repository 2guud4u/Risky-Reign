import mongoose from "mongoose";
import PlayerInt from "../types/Player";
import { devCardSchema } from "./DevCard";


export const playerSchema = new mongoose.Schema<PlayerInt>({
    name: {
        type: String,
        required: true
    },
    color: {
        type: String,
        required: true
    },
    resources: {
        type: Map,
        of: { type: Number },
        required: true
    },
    devCards: {
        type: [devCardSchema],
    }
});

const Player = mongoose.model('Player', playerSchema);
export default Player;
