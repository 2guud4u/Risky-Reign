import { useEffect, useState } from 'react';
import { UiEvent, UiEventPayload } from '../utils/eventsUtils';
import { TurnState } from '../utils/turnUtils';
interface InventoryProps {}

const Inventory: React.FC<InventoryProps> = () => {
    return <div style={{ border: '2px solid black', padding: '16px' }}>Inventory</div>;
};

export default Inventory;
