"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// Montar el <Toaster/> es lo que hace que aparezca cualquier toast() de la app.
// El sitio entero es oscuro y no tiene selector de tema, asi que el tema se fija
// en dark en vez de consultarlo.
//
// Los colores salen de la paleta de globals.css (--surface-2, --line-strong,
// --text...). Antes este componente usaba --popover y --border, que son
// variables del tema de shadcn: este proyecto no las tiene, y --popover sin
// definir deja el fondo del aviso sin color.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--surface-2)",
          "--normal-text": "var(--text)",
          "--normal-border": "var(--line-strong)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }