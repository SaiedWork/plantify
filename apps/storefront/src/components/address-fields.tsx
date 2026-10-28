"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type AddressValues = {
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
};

export const EMPTY_ADDRESS: AddressValues = { fullName: "", line1: "", line2: "", city: "", region: "", postalCode: "" };

type FieldDef = { key: keyof AddressValues; label: string; required: boolean; span?: boolean; autoComplete?: string };

const FIELDS: FieldDef[] = [
  { key: "fullName", label: "Full name", required: true, span: true, autoComplete: "name" },
  { key: "line1", label: "Address", required: true, span: true, autoComplete: "address-line1" },
  { key: "line2", label: "Apartment, suite (optional)", required: false, span: true, autoComplete: "address-line2" },
  { key: "city", label: "City", required: true, autoComplete: "address-level2" },
  { key: "region", label: "State (optional)", required: false, autoComplete: "address-level1" },
  { key: "postalCode", label: "ZIP code", required: true, autoComplete: "postal-code" },
];

export function AddressFields({
  value,
  onChange,
  disabled,
  idPrefix = "addr",
}: {
  value: AddressValues;
  onChange: (next: AddressValues) => void;
  disabled?: boolean;
  idPrefix?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {FIELDS.map((f) => (
        <div key={f.key} className={cn("space-y-2", f.span && "sm:col-span-2")}>
          <Label htmlFor={`${idPrefix}-${f.key}`}>{f.label}</Label>
          <Input
            id={`${idPrefix}-${f.key}`}
            value={value[f.key]}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
            required={f.required}
            disabled={disabled}
            maxLength={120}
            autoComplete={f.autoComplete}
          />
        </div>
      ))}
    </div>
  );
}

/** Trims and drops empty optional fields so the API gets exactly what it validates. */
export function toAddressPayload(v: AddressValues) {
  const line2 = v.line2.trim();
  const region = v.region.trim();
  return {
    fullName: v.fullName.trim(),
    line1: v.line1.trim(),
    ...(line2 ? { line2 } : {}),
    city: v.city.trim(),
    ...(region ? { region } : {}),
    postalCode: v.postalCode.trim(),
    country: "US",
  };
}
