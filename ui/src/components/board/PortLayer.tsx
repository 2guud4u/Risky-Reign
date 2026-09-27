import React from 'react';
import { PortDock } from '../PortDock';
import { PORT_DOCK_SIZE } from '../../constants';
import { PortGroup } from '../../types/board';

/**
 * Trade ports (harbors): one icon per dock, with a little road to each of the
 * 1-2 vertices it serves.
 */
export const PortLayer: React.FC<{ portGroups: PortGroup[] }> = ({ portGroups }) => (
  <>
    {portGroups.map((g, i) => (
      <PortDock key={`port-${i}`} vertices={g.vertices} port={g.port} size={PORT_DOCK_SIZE} />
    ))}
  </>
);
