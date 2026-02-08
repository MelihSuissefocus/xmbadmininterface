"use client";

import React, { useCallback } from "react";
import { useFormContext, Controller } from "react-hook-form";
import type { CvDesignConfig } from "@/lib/cv-generator/schema";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { HexColorPicker } from "react-colorful";
import { Paintbrush, Type, Layout, Eye, Save } from "lucide-react";

interface DesignControlsProps {
  onSaveDefaults: () => void;
}

export function DesignControls({ onSaveDefaults }: DesignControlsProps) {
  const { control, watch, setValue } = useFormContext<CvDesignConfig>();

  return (
    <Accordion type="multiple" defaultValue={["branding", "layout", "visibility"]} className="w-full">
      {/* ── Branding ─────────────────────────────────────── */}
      <AccordionItem value="branding">
        <AccordionTrigger>
          <span className="flex items-center gap-2">
            <Paintbrush className="h-4 w-4" />
            Firmen-Branding
          </span>
        </AccordionTrigger>
        <AccordionContent className="space-y-4">
          {/* Company name */}
          <div className="space-y-1.5">
            <Label htmlFor="companyName">Firmenname</Label>
            <Controller
              control={control}
              name="header.companyName"
              render={({ field }) => (
                <Input id="companyName" {...field} />
              )}
            />
          </div>

          {/* Slogan */}
          <div className="space-y-1.5">
            <Label htmlFor="companySlogan">Slogan</Label>
            <Controller
              control={control}
              name="header.companySlogan"
              render={({ field }) => (
                <Input id="companySlogan" placeholder="optional" {...field} />
              )}
            />
          </div>

          {/* Logo URL */}
          <div className="space-y-1.5">
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Controller
              control={control}
              name="header.logoUrl"
              render={({ field }) => (
                <Input id="logoUrl" placeholder="https://..." {...field} />
              )}
            />
          </div>

          {/* Logo position */}
          <div className="space-y-1.5">
            <Label>Logo-Position</Label>
            <Controller
              control={control}
              name="header.logoPosition"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Links</SelectItem>
                    <SelectItem value="center">Zentriert</SelectItem>
                    <SelectItem value="right">Rechts</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Primary color */}
          <div className="space-y-2">
            <Label>Akzentfarbe</Label>
            <Controller
              control={control}
              name="global.primaryColor"
              render={({ field }) => (
                <div className="space-y-2">
                  <HexColorPicker
                    color={field.value}
                    onChange={field.onChange}
                    style={{ width: "100%" }}
                  />
                  <Input
                    value={field.value}
                    onChange={field.onChange}
                    className="font-mono text-xs"
                  />
                </div>
              )}
            />
          </div>

          {/* Save as default */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onSaveDefaults}
          >
            <Save className="mr-2 h-3.5 w-3.5" />
            Als Standard speichern
          </Button>
        </AccordionContent>
      </AccordionItem>

      {/* ── Layout & Geometrie ───────────────────────────── */}
      <AccordionItem value="layout">
        <AccordionTrigger>
          <span className="flex items-center gap-2">
            <Layout className="h-4 w-4" />
            Layout &amp; Geometrie
          </span>
        </AccordionTrigger>
        <AccordionContent className="space-y-5">
          {/* Logo width */}
          <SliderField
            control={control}
            name="header.logoWidth"
            label="Logo-Breite"
            min={40}
            max={300}
            unit="px"
          />

          {/* Sidebar width */}
          <SliderField
            control={control}
            name="layout.sidebarWidth"
            label="Sidebar-Breite"
            min={20}
            max={45}
            unit="%"
          />

          {/* Page margin */}
          <SliderField
            control={control}
            name="layout.pageMargin"
            label="Seitenrand"
            min={10}
            max={40}
            unit="mm"
          />

          {/* Font family */}
          <div className="space-y-1.5">
            <Label>Schriftart</Label>
            <Controller
              control={control}
              name="global.fontFamily"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Helvetica">Helvetica</SelectItem>
                    <SelectItem value="Times-Roman">Times Roman</SelectItem>
                    <SelectItem value="Courier">Courier</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── Typografie ────────────────────────────────────── */}
      <AccordionItem value="typography">
        <AccordionTrigger>
          <span className="flex items-center gap-2">
            <Type className="h-4 w-4" />
            Typografie
          </span>
        </AccordionTrigger>
        <AccordionContent className="space-y-5">
          <SliderField
            control={control}
            name="typography.headingSize"
            label="Überschrift"
            min={10}
            max={24}
            unit="pt"
          />
          <SliderField
            control={control}
            name="typography.bodySize"
            label="Fließtext"
            min={7}
            max={14}
            unit="pt"
          />
          <SliderField
            control={control}
            name="global.baseFontSize"
            label="Basis-Schriftgröße"
            min={6}
            max={16}
            unit="pt"
          />
          <SliderField
            control={control}
            name="global.lineHeight"
            label="Zeilenhöhe"
            min={1}
            max={2.5}
            step={0.1}
            unit="×"
          />
        </AccordionContent>
      </AccordionItem>

      {/* ── Sichtbarkeit ──────────────────────────────────── */}
      <AccordionItem value="visibility">
        <AccordionTrigger>
          <span className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Sektionen
          </span>
        </AccordionTrigger>
        <AccordionContent className="space-y-4">
          <SwitchField
            control={control}
            name="sections.showPhoto"
            label="Bewerberfoto anzeigen"
          />
          <SwitchField
            control={control}
            name="sections.showSignature"
            label="Unterschrift anzeigen"
          />
          <SwitchField
            control={control}
            name="header.showCompanyInfo"
            label="Firmen-Header anzeigen"
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

// ─── Generic Field Helpers ────────────────────────────────────────────────────

function SliderField({
  control,
  name,
  label,
  min,
  max,
  step = 1,
  unit,
}: {
  control: ReturnType<typeof useFormContext<CvDesignConfig>>["control"];
  name:
    | "header.logoWidth"
    | "layout.sidebarWidth"
    | "layout.pageMargin"
    | "typography.headingSize"
    | "typography.bodySize"
    | "global.baseFontSize"
    | "global.lineHeight";
  label: string;
  min: number;
  max: number;
  step?: number;
  unit: string;
}) {
  return (
    <div className="space-y-2">
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <>
            <div className="flex items-center justify-between">
              <Label>{label}</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {typeof field.value === "number"
                  ? step < 1
                    ? field.value.toFixed(1)
                    : field.value
                  : field.value}
                {unit}
              </span>
            </div>
            <Slider
              min={min}
              max={max}
              step={step}
              value={[typeof field.value === "number" ? field.value : min]}
              onValueChange={([v]) => field.onChange(v)}
            />
          </>
        )}
      />
    </div>
  );
}

function SwitchField({
  control,
  name,
  label,
}: {
  control: ReturnType<typeof useFormContext<CvDesignConfig>>["control"];
  name: "sections.showPhoto" | "sections.showSignature" | "header.showCompanyInfo";
  label: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-center justify-between">
          <Label>{label}</Label>
          <Switch
            checked={!!field.value}
            onCheckedChange={field.onChange}
          />
        </div>
      )}
    />
  );
}
