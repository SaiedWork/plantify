CREATE TABLE "order_event" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "contact_email" text;--> statement-breakpoint
UPDATE "order" o SET "contact_email" = u."email" FROM "user" u WHERE u."id" = o."user_id";--> statement-breakpoint
ALTER TABLE "order" ALTER COLUMN "contact_email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "cart_id" text;--> statement-breakpoint
ALTER TABLE "order_event" ADD CONSTRAINT "order_event_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_event_order_idx" ON "order_event" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_contact_email_idx" ON "order" USING btree ("contact_email");
--> statement-breakpoint
INSERT INTO "order_event" ("id", "order_id", "status", "created_at") SELECT gen_random_uuid()::text, "id", "status", "updated_at" FROM "order";--> statement-breakpoint
CREATE FUNCTION "order_record_status_event"() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		INSERT INTO "order_event" ("id", "order_id", "status", "created_at") VALUES (gen_random_uuid()::text, NEW."id", NEW."status", NEW."placed_at");
	ELSIF NEW."status" IS DISTINCT FROM OLD."status" THEN
		INSERT INTO "order_event" ("id", "order_id", "status") VALUES (gen_random_uuid()::text, NEW."id", NEW."status");
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "order_status_event" AFTER INSERT OR UPDATE OF "status" ON "order" FOR EACH ROW EXECUTE FUNCTION "order_record_status_event"();