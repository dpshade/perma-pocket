import * as React from "react"
import { cn } from "@/shared/utils/cn"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95",
          {
            "bg-primary text-primary-foreground [@media(hover:hover)]:hover:bg-primary/90 [@media(hover:hover)]:hover:shadow-md": variant === "default",
            "bg-destructive text-destructive-foreground [@media(hover:hover)]:hover:bg-destructive/90": variant === "destructive",
            "border border-input bg-background [@media(hover:hover)]:hover:bg-accent [@media(hover:hover)]:hover:text-accent-foreground [@media(hover:hover)]:hover:border-accent": variant === "outline",
            "bg-secondary text-secondary-foreground [@media(hover:hover)]:hover:bg-secondary/80": variant === "secondary",
            "[@media(hover:hover)]:hover:bg-accent [@media(hover:hover)]:hover:text-accent-foreground": variant === "ghost",
            "text-primary underline-offset-4 [@media(hover:hover)]:hover:underline": variant === "link",
            "h-10 px-4 py-2": size === "default",
            "h-9 rounded-md px-3": size === "sm",
            "h-11 rounded-md px-8": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }