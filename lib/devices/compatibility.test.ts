import assert from "node:assert/strict";
import test from "node:test";

import { checkDeviceCompatibility } from "./compatibility";

test("recognizes a current compatible iPhone", () => {
  assert.equal(checkDeviceCompatibility("iPhone 15 Pro").status, "compatible");
  assert.equal(checkDeviceCompatibility("iPhone SE 2nd generation").status, "compatible");
  assert.equal(checkDeviceCompatibility("iPhone SE 2020").status, "compatible");
  assert.equal(checkDeviceCompatibility("iPhone SE 3rd generation").status, "compatible");
});

test("rejects known physical-SIM-only iPhones", () => {
  assert.equal(checkDeviceCompatibility("iPhone X").status, "not-compatible");
  assert.equal(checkDeviceCompatibility("iPhone SE 1st generation").status, "not-compatible");
});

test("recognizes only manufacturer-listed Samsung variants", () => {
  assert.equal(checkDeviceCompatibility("Samsung Galaxy S24 Ultra").status, "compatible");
  assert.equal(checkDeviceCompatibility("Samsung Galaxy Z Fold 6").status, "compatible");
  assert.equal(checkDeviceCompatibility("Samsung Galaxy XCover6 Pro").status, "compatible");
});

test("does not infer support for unlisted Samsung variants", () => {
  assert.equal(checkDeviceCompatibility("Samsung Galaxy S20 FE").status, "unknown");
  assert.equal(checkDeviceCompatibility("Samsung Galaxy Z Fold 9").status, "unknown");
  assert.equal(checkDeviceCompatibility("Samsung Galaxy XCover6").status, "unknown");
});

test("does not overclaim regional Galaxy A variants", () => {
  assert.equal(checkDeviceCompatibility("Samsung Galaxy A54").status, "unknown");
});

test("recognizes manufacturer-documented Motorola, Huawei, and Xiaomi models", () => {
  assert.equal(checkDeviceCompatibility("Motorola Edge 50").status, "compatible");
  assert.equal(checkDeviceCompatibility("Motorola Razr 50 Ultra").status, "compatible");
  assert.equal(checkDeviceCompatibility("Huawei P40 Pro").status, "compatible");
  assert.equal(checkDeviceCompatibility("Huawei Mate 40 Pro").status, "compatible");
  assert.equal(checkDeviceCompatibility("Xiaomi 12T Pro").status, "compatible");
  assert.equal(checkDeviceCompatibility("Xiaomi 13T").status, "compatible");
  assert.equal(checkDeviceCompatibility("Xiaomi 14").status, "compatible");
  assert.equal(checkDeviceCompatibility("Xiaomi 14T Pro").status, "compatible");
  assert.equal(checkDeviceCompatibility("Xiaomi 15").status, "compatible");
});

test("rejects a manufacturer-documented Xiaomi model without eSIM", () => {
  assert.equal(checkDeviceCompatibility("Xiaomi 12").status, "not-compatible");
});

test("does not generalize support to neighboring device variants", () => {
  assert.equal(checkDeviceCompatibility("Motorola Edge 50 Pro").status, "unknown");
  assert.equal(checkDeviceCompatibility("Xiaomi 14 Ultra").status, "unknown");
  assert.equal(checkDeviceCompatibility("Huawei P40 Lite").status, "unknown");
});

test("returns unknown for unlisted models", () => {
  assert.equal(checkDeviceCompatibility("Mystery Phone 3000").status, "unknown");
});
