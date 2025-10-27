import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <Image src="/logo.png" alt="Logo" width={100} height={100} />
      <h1 className="text-4xl font-bold">Parking App</h1>
      <p className="text-lg">Find your parking spot easily</p>
    </div>
  );
}
