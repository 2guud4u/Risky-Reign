import CatanBoard from '../../frontend/src/CatanBoard';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">Catan Board</h1>
      <p className="mb-8 text-center">
        Drag the red square and drop it on a hexagon to place a settlement.
        <br />
        You can place multiple settlements on the board.
      </p>
      <CatanBoard />
    </main>
  );
}

