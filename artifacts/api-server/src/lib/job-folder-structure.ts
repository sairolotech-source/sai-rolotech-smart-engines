import path from "path";

export function sanitizeFolderName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-. ]/g, "_").trim().substring(0, 100);
}

export function rollFileName(position: string, stationId: string | number, ext = "tap"): string {
  const safePos = position.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeStation = String(stationId).replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${safePos}_station_${safeStation}.${ext}`;
}

export function cncFileName(position: string, stationId: string | number, ext = "nc"): string {
  const safePos = position.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeStation = String(stationId).replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${safePos}_station_${safeStation}.${ext}`;
}

export interface JobFolderPaths {
  root: string;
  gcode: string;
  dxf: string;
  reports: string;
  backups: string;
  flowerPattern: string;
  rollsTop: string;
  rollsBottom: string;
  cncCode: string;
}

export function buildJobFolderPaths(baseDir: string, jobName: string): JobFolderPaths {
  const safe = sanitizeFolderName(jobName);
  const root = path.join(baseDir, safe);
  return {
    root,
    gcode: path.join(root, "gcode"),
    dxf: path.join(root, "dxf"),
    reports: path.join(root, "reports"),
    backups: path.join(root, "backups"),
    flowerPattern: path.join(root, "flower"),
    rollsTop: path.join(root, "rolls", "top"),
    rollsBottom: path.join(root, "rolls", "bottom"),
    cncCode: path.join(root, "cnc"),
  };
}

export function describeFolderTree(profileName: string, numStations: number): string {
  return [
    `Profile: ${profileName}  |  Stations: ${numStations}`,
    `  ├── flower/       (Flower pattern data)`,
    `  ├── rolls/top/    (Upper roll G-code)`,
    `  ├── rolls/bottom/ (Lower roll G-code)`,
    `  ├── cnc/          (CNC programs)`,
    `  ├── gcode/        (Main G-code)`,
    `  ├── dxf/          (2D DXF drawings)`,
    `  ├── reports/      (Analysis reports)`,
    `  └── backups/      (Project backups)`,
  ].join("\n");
}
