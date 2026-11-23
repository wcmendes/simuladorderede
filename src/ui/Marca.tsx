// Avatar do professor como marca d'água discreta nas telas de estudo (some no celular).
export function Marca({ route }: { route: string }) {
  const visivel = route.startsWith('/aula') || route.startsWith('/mascara') || route.startsWith('/ajuda');
  if (!visivel) return null;
  return <MarcaImg />;
}

export function MarcaImg() {
  return <img className="avatar-marca" src="/will.webp" alt="" aria-hidden="true" />;
}
