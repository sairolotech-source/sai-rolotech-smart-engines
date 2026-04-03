import {
  pgTable,
  text,
  numeric,
  integer,
  timestamp,
  jsonb,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";

export const rfProjects = pgTable("rf_projects", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  projectName: text("project_name").notNull(),
  material: text("material").notNull().default("GI"),
  thickness: numeric("thickness").notNull().default("1.0"),
  numStations: integer("num_stations").notNull().default(5),
  stationPrefix: text("station_prefix").notNull().default("S"),
  lineSpeed: numeric("line_speed").default("20"),
  rollDiameter: numeric("roll_diameter").default("150"),
  shaftDiameter: numeric("shaft_diameter").default("40"),
  clearance: numeric("clearance").default("0.05"),
  profileName: text("profile_name").default(""),
  fileName: text("file_name").default(""),
  createdAt: timestamp("created_at").default(sql`NOW()`),
  updatedAt: timestamp("updated_at").default(sql`NOW()`),
});

export const rfBends = pgTable("rf_bends", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid("project_id").references(() => rfProjects.id, {
    onDelete: "cascade",
  }),
  bendOrder: integer("bend_order").notNull(),
  bendAngle: numeric("bend_angle"),
  bendRadius: numeric("bend_radius"),
  flangeLength: numeric("flange_length"),
  side: text("side").default("left"),
});

export const rfAnalysisResults = pgTable("rf_analysis_results", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid("project_id").references(() => rfProjects.id, {
    onDelete: "cascade",
  }),
  bendCount: integer("bend_count"),
  suggestedPasses: integer("suggested_passes"),
  riskLevel: text("risk_level"),
  totalBendAngle: numeric("total_bend_angle"),
  notes: jsonb("notes").default({}),
  createdAt: timestamp("created_at").default(sql`NOW()`),
});

export const insertRfProjectSchema = createInsertSchema(rfProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRfProject = z.infer<typeof insertRfProjectSchema>;
export type RfProject = typeof rfProjects.$inferSelect;
export type RfBend = typeof rfBends.$inferSelect;
export type RfAnalysisResult = typeof rfAnalysisResults.$inferSelect;
