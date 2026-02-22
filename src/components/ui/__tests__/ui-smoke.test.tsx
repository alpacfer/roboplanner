import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

describe("shadcn ui smoke", () => {
  it("renders generated primitives", () => {
    render(
      <div>
        <Button type="button">Smoke Button</Button>
        <ButtonGroup aria-label="Smoke button group">
          <Button type="button" variant="outline">
            Group A
          </Button>
          <Button type="button" variant="outline">
            Group B
          </Button>
        </ButtonGroup>
        <Card>
          <CardHeader>
            <CardTitle>Smoke Card</CardTitle>
          </CardHeader>
          <CardContent>Card body</CardContent>
        </Card>
        <Badge>Smoke Badge</Badge>
        <Dialog>
          <DialogTrigger>Open dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Smoke Dialog</DialogTitle>
              <DialogDescription>Dialog description</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
        <Label htmlFor="smoke-input">Smoke Input</Label>
        <Input aria-label="Smoke input" id="smoke-input" defaultValue="hello" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Head</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Popover>
          <PopoverTrigger>Open popover</PopoverTrigger>
          <PopoverContent>
            <PopoverTitle>Smoke Popover</PopoverTitle>
            <PopoverDescription>Popover description</PopoverDescription>
          </PopoverContent>
        </Popover>
        <Label htmlFor="smoke-native-select">Smoke Select</Label>
        <NativeSelect aria-label="Smoke select" id="smoke-native-select" defaultValue="a">
          <NativeSelectOption value="a">A</NativeSelectOption>
          <NativeSelectOption value="b">B</NativeSelectOption>
        </NativeSelect>
        <Label htmlFor="smoke-checkbox">Smoke Checkbox</Label>
        <Checkbox aria-label="Smoke checkbox" id="smoke-checkbox" defaultChecked />
        <Separator />
        <Collapsible open>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Smoke Collapsible</CollapsibleContent>
        </Collapsible>
      </div>,
    );

    expect(screen.getByRole("button", { name: "Smoke Button" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Smoke button group" })).toBeTruthy();
    expect(screen.getByText("Smoke Card")).toBeTruthy();
    expect(screen.getByText("Smoke Badge")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open dialog" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Smoke input" })).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open popover" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Smoke select" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Smoke checkbox" })).toBeTruthy();
    expect(screen.getByText("Smoke Collapsible")).toBeTruthy();
  });
});
