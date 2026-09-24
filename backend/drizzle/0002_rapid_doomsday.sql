CREATE TABLE "test_workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"weight" integer NOT NULL,
	CONSTRAINT "test_workflows_test_id_workflow_id_unique" UNIQUE("test_id","workflow_id")
);
--> statement-breakpoint
ALTER TABLE "endpoints" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "endpoints" CASCADE;--> statement-breakpoint
ALTER TABLE "tests" DROP CONSTRAINT "tests_workflow_id_workflows_id_fk";
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "base_url" varchar(200) NOT NULL;--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN "target_url" varchar(200) NOT NULL;--> statement-breakpoint
ALTER TABLE "test_workflows" ADD CONSTRAINT "test_workflows_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_workflows" ADD CONSTRAINT "test_workflows_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" DROP COLUMN "workflow_id";--> statement-breakpoint
ALTER TABLE "tests" DROP COLUMN "endpoint_id";