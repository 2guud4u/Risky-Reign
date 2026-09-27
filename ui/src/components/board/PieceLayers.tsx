import React from 'react';
import { BoardEdge } from '../BoardEdge';
import { BoardVertex } from '../BoardVertex';
import { BOARD_VERTEX_SIZE } from '../../constants';
import { BoardEdgeRender, BoardVertexRender } from '../../types/board';

/** Edges layer: roads tinted in the owner's color, hover/select ring. */
export const EdgeLayer = React.memo(function EdgeLayer({
  edges,
  onClick,
  onHover,
}: {
  edges: BoardEdgeRender[];
  onClick: (edgeId: string) => void;
  onHover: (edgeId: string | null) => void;
}) {
  return (
    <>
      {edges.map((edge) => (
        <BoardEdge key={edge.id} {...edge} onClick={onClick} onHover={onHover} />
      ))}
    </>
  );
});

/** Vertices layer: settlements/cities tinted in the owner's color. */
export const VertexLayer = React.memo(function VertexLayer({
  vertices,
  onClick,
  onHover,
}: {
  vertices: BoardVertexRender[];
  onClick: (vertexId: string) => void;
  onHover: (vertexId: string | null) => void;
}) {
  return (
    <>
      {vertices.map((vertex) => (
        <BoardVertex
          key={vertex.id}
          {...vertex}
          size={BOARD_VERTEX_SIZE}
          onClick={onClick}
          onHover={onHover}
        />
      ))}
    </>
  );
});
