import React from 'react';
import { PortDock } from '../PortDock';
import { PORT_DOCK_SIZE } from '../../constants';
import { PortGroup } from '../../types/board';

/**
 * Trade ports (harbors): one icon per dock, with a little road to each of the
 * 1-2 vertices it serves. Memoized — the ports never change with hover/drag.
 */
export const PortLayer = React.memo(function PortLayer({
  portGroups,
}: {
  portGroups: PortGroup[];
}) {
  return (
    <>
      {portGroups.map((g, i) => (
        <PortDock key={`port-${i}`} vertices={g.vertices} port={g.port} size={PORT_DOCK_SIZE} />
      ))}
    </>
  );
});
