import { Card, Flex, Spinner, Stack, Text } from "@sanity/ui";
import {
  type NumberInputProps,
  type Reference,
  set,
  unset,
  useClient,
  useFormValue
} from "sanity";
import { useEffect, useMemo, useState } from "react";

const apiVersion = process.env.SANITY_API_VERSION || "2025-01-01";

export function CatalogPackagePriceInput(props: NumberInputProps) {
  const { renderDefault, onChange } = props;
  const packageRef = useFormValue(["package"]) as Reference | undefined;
  const client = useClient({ apiVersion });
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const packageId = useMemo(() => packageRef?._ref, [packageRef]);

  useEffect(() => {
    let cancelled = false;

    async function syncPriceFromPackage() {
      if (!packageId) {
        setStatus("idle");
        setMessage("Select a catalog package to sync price.");
        onChange?.(unset());
        return;
      }

      setStatus("loading");
      setMessage(null);

      try {
        const sellingPriceCents = await client.fetch<number | null>(
          `*[_id == $id][0].sellingPriceCents`,
          { id: packageId }
        );

        if (cancelled) {
          return;
        }

        if (typeof sellingPriceCents === "number") {
          const price = Number((sellingPriceCents / 100).toFixed(2));
          onChange?.(set(price));
          setStatus("idle");
          setMessage(`Synced from sellingPriceCents (${sellingPriceCents}¢).`);
        } else {
          onChange?.(unset());
          setStatus("error");
          setMessage("Selected package is missing a selling price.");
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        onChange?.(unset());
        setStatus("error");
        setMessage("Could not load selling price. Check your permissions.");
      }
    }

    syncPriceFromPackage();

    return () => {
      cancelled = true;
    };
  }, [client, onChange, packageId]);

  return (
    <Stack space={3}>
      {renderDefault({ ...props, readOnly: true })}

      <Card padding={3} radius={2} shadow={1} tone={status === "error" ? "critical" : "primary"}>
        <Flex align="center" gap={3}>
          {status === "loading" ? (
            <Spinner muted />
          ) : (
            <Text size={1} muted={status !== "error"}>
              {message ?? "Price is kept in sync with the selected catalog package."}
            </Text>
          )}
        </Flex>
      </Card>
    </Stack>
  );
}
