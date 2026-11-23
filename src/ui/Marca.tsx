// Avatar do professor como marca d'água discreta nas telas de estudo (some no celular).
export function Marca({ route }: { route: string }) {
  const entrou = !!localStorage.getItem('labredes-join');
  const visivel =
    route.startsWith('/aula') || route.startsWith('/mascara') || route.startsWith('/ajuda') || (route.startsWith('/entrar') && !entrou);
  if (!visivel) return null;
  return <img className="avatar-marca" src="/will.webp" alt="" aria-hidden="true" />;
}
