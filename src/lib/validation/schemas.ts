import { z } from "zod";

export const utmSchema = z
  .object({
    source: z.string().max(200).optional(),
    medium: z.string().max(200).optional(),
    campaign: z.string().max(200).optional(),
    content: z.string().max(200).optional(),
    term: z.string().max(200).optional(),
  })
  .partial()
  .optional();

export const leadInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  telegram: z
    .string()
    .trim()
    .transform((v) => v.replace(/^@+/, ""))
    .refine((v) => /^[A-Za-z0-9_]{2,32}$/.test(v), {
      message: "Telegram username must be 2-32 chars (letters, digits, underscore)",
    }),
  productSlug: z.string().min(1).max(64).default("level-0"),
  locale: z.enum(["uk", "ru"]).optional(),
  referer: z.string().max(2048).optional(),
  utm: utmSchema,
});

export type LeadInput = z.infer<typeof leadInputSchema>;
