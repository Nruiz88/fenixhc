import * as React from "react"

import { cn } from "@/lib/utils"

function Card({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "group/card flex flex-col overflow-hidden rounded-xl border border-line bg-surface text-main",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex items-start justify-between gap-3 border-b border-line px-4 py-3", className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-title" className={cn("text-sm font-semibold text-main", className)} {...props} />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-description" className={cn("text-xs text-dim", className)} {...props} />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-action" className={cn("flex shrink-0 items-center gap-2", className)} {...props} />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("p-4", className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-2 border-t border-line bg-surface-2 px-4 py-3", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
