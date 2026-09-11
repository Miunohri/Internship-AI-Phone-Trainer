import { prisma } from "@/lib/prisma";

export interface BrandingSettings {
  shopName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export const DEFAULT_BRANDING: BrandingSettings = {
  shopName: "JB Import Auto",
  logoUrl: "/jb-logo.png",
  primaryColor: "#002f6b",
  secondaryColor: "#5c7bb1",
  accentColor: "#3b3a39",
};

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const RELATIVE_LOGO_PATH_PATTERN =
  /^\/[a-zA-Z0-9][a-zA-Z0-9\-._~!$&'()*+,;=:@/%]*$/;

export class BrandingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrandingValidationError";
  }
}

function validateShopName(value: unknown): string {
  if (typeof value !== "string") {
    throw new BrandingValidationError("Shop name must be text.");
  }

  const shopName = value.trim();

  if (shopName.length < 1 || shopName.length > 100) {
    throw new BrandingValidationError(
      "Shop name must be between 1 and 100 characters."
    );
  }

  return shopName;
}

function validateLogoUrl(value: unknown): string {
  if (typeof value !== "string") {
    throw new BrandingValidationError("Logo URL must be text.");
  }

  const logoUrl = value.trim();

  if (logoUrl.length < 1 || logoUrl.length > 500) {
    throw new BrandingValidationError(
      "Logo URL must be between 1 and 500 characters."
    );
  }

  if (RELATIVE_LOGO_PATH_PATTERN.test(logoUrl)) {
    return logoUrl;
  }

  try {
    const parsed = new URL(logoUrl);

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new BrandingValidationError(
        "Logo URL must use http or https."
      );
    }

    return parsed.toString();
  } catch (error) {
    if (error instanceof BrandingValidationError) {
      throw error;
    }

    throw new BrandingValidationError(
      "Logo must be a valid http/https URL or a root-relative path."
    );
  }
}

function validateColor(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !HEX_COLOR_PATTERN.test(value)) {
    throw new BrandingValidationError(
      `${fieldName} must be a six-digit hex color such as #002f6b.`
    );
  }

  return value.toLowerCase();
}

export function validateBrandingSettings(
  value: unknown
): BrandingSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BrandingValidationError(
      "Branding settings must be an object."
    );
  }

  const input = value as Record<string, unknown>;

  return {
    shopName: validateShopName(input.shopName),
    logoUrl: validateLogoUrl(input.logoUrl),
    primaryColor: validateColor(
      input.primaryColor,
      "Primary color"
    ),
    secondaryColor: validateColor(
      input.secondaryColor,
      "Secondary color"
    ),
    accentColor: validateColor(
      input.accentColor,
      "Accent color"
    ),
  };
}

export async function readBranding(): Promise<BrandingSettings> {
  const branding = await prisma.appBranding.findUnique({
    where: {
      id: "default",
    },
  });

  if (!branding) {
    return { ...DEFAULT_BRANDING };
  }

  return {
    shopName: branding.shopName,
    logoUrl: branding.logoUrl,
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    accentColor: branding.accentColor,
  };
}

export async function writeBranding(
  value: unknown
): Promise<BrandingSettings> {
  const settings = validateBrandingSettings(value);

  const branding = await prisma.appBranding.upsert({
    where: {
      id: "default",
    },
    create: {
      id: "default",
      ...settings,
    },
    update: settings,
  });

  return {
    shopName: branding.shopName,
    logoUrl: branding.logoUrl,
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    accentColor: branding.accentColor,
  };
}
