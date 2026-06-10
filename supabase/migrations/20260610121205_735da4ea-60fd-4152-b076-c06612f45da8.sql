
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  brand TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT '$',
  note TEXT,
  location TEXT,
  receipt_path TEXT,
  merchant TEXT,
  purchased_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX transactions_device_idx ON public.transactions(device_id, created_at DESC);
CREATE INDEX transactions_card_idx ON public.transactions(device_id, card_id, created_at DESC);

CREATE TABLE public.receipt_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  qty NUMERIC(10,2),
  price NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX receipt_items_tx_idx ON public.receipt_items(transaction_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO anon, authenticated;
GRANT ALL ON public.transactions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipt_items TO anon, authenticated;
GRANT ALL ON public.receipt_items TO service_role;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;

-- MVP: anonymous device-scoped access. Anyone can read/write any row; client
-- filters by device_id stored in localStorage. Acceptable for prototype.
CREATE POLICY "anon read transactions" ON public.transactions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon insert transactions" ON public.transactions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon update transactions" ON public.transactions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon delete transactions" ON public.transactions FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "anon read items" ON public.receipt_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon insert items" ON public.receipt_items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon update items" ON public.receipt_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon delete items" ON public.receipt_items FOR DELETE TO anon, authenticated USING (true);

-- Storage policies for the 'receipts' bucket so anon clients can upload/read.
CREATE POLICY "anon read receipts" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'receipts');
CREATE POLICY "anon upload receipts" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'receipts');
CREATE POLICY "anon delete receipts" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'receipts');
