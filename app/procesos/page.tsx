import { redirect } from 'next/navigation'

// La gestion de procesos vive en el Centro de control (/panel, "Gestion de procesos"). Esta pagina era una copia
// antigua que ya no estaba enlazada en ningun lado y se desactualizaba; se deja solo la redireccion para los enlaces guardados.
export default function ProcesosPage() {
  redirect('/panel')
}
