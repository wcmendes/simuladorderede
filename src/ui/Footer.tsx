// Rodapé com os dados do autor, presente em todas as telas.
export function Footer() {
  return (
    <footer className="app-footer">
      <span>
        <b>LabRedes</b> — simulador de rede para a turma de Redes de Computadores
      </span>
      <span className="sep">·</span>
      <span>
        Prof. <b>William Corrêa Mendes</b>
      </span>
      <span className="sep">·</span>
      <a href="https://lattes.cnpq.br/7726054867638395" target="_blank" rel="noopener noreferrer">
        Currículo Lattes
      </a>
      <span className="sep">·</span>
      <a href="https://github.com/wcmendes/simuladorderede" target="_blank" rel="noopener noreferrer">
        Código no GitHub
      </a>
      <span className="sep">·</span>
      <span className="muted">Material educacional — uso livre com crédito ao autor</span>
    </footer>
  );
}
