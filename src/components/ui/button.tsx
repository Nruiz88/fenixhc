import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // focus-visible con ring en vez de border: se ve el foco al tabular con
  // teclado, que antes no se notaba.
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-transparent text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-brand/60 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Acción principal: la marca del club.
        default: "bg-brand text-white hover:bg-brand-dark shadow-sm",
        // Acción secundaria: no compite visualmente con la principal.
        outline: "border-line bg-surface-2 text-main hover:bg-surface-3 hover:border-line-strong",
        secondary: "bg-surface-3 text-main hover:bg-line",
        ghost: "text-muted hover:bg-surface-2 hover:text-main",
        // Solo para acciones destructivas (borrar, cancelar).
        destructive: "bg-danger/10 text-danger hover:bg-danger/20 border border-danger/25",
        success: "bg-ok/10 text-ok hover:bg-ok/20 border border-ok/25",
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: {
        // Alturas de 36-40px en vez de 28-32: la version anterior era
        // chica para hacer clic con precision, sobre todo en movil.
        default: "h-9 px-3.5 text-sm",
        sm: "h-8 px-3 text-[0.8rem]",
        lg: "h-10 px-5",
        xs: "h-7 px-2 text-xs",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-xs": "size-7",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
