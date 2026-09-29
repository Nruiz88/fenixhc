import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-brand/50 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-surface-3 text-muted",
        // Alias que siguen usando varias paginas; mismo color que default.
        secondary: "bg-surface-3 text-muted",
        brand: "bg-brand/10 text-brand",
        ok: "bg-ok/10 text-ok",
        warn: "bg-warn/10 text-warn",
        danger: "bg-danger/10 text-danger",
        info: "bg-info/10 text-info",
        outline: "border-line text-muted",
        link: "text-brand underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
