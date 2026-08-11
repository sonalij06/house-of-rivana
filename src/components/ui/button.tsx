import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium select-none transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-ink text-cream hover:bg-gold active:scale-[0.985] shadow-soft hover:shadow-lift",
        gold: "bg-gold text-cream hover:bg-gold-dark active:scale-[0.985] shadow-soft hover:shadow-lift",
        outline:
          "border border-ink/85 text-ink hover:border-gold hover:text-gold active:scale-[0.985]",
        subtle:
          "border border-hairline bg-surface text-ink hover:border-champagne hover:bg-cream",
        ghost: "text-ink hover:bg-cream-dark",
        link: "text-ink underline-offset-4 hover:text-gold hover:underline",
        danger: "bg-danger text-white hover:brightness-110 active:scale-[0.985]",
      },
      size: {
        sm: "h-9 px-4 text-[0.75rem] tracking-[0.12em] uppercase rounded-xs",
        md: "h-11 px-6 text-[0.8125rem] tracking-[0.14em] uppercase rounded-xs",
        lg: "h-13 px-9 text-[0.8125rem] tracking-[0.16em] uppercase rounded-xs",
        icon: "size-10 rounded-xs",
        "icon-sm": "size-8 rounded-xs",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

export type ButtonProps = React.ComponentPropsWithoutRef<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
