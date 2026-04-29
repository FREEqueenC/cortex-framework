/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

function generateIncrementalMergeScript(ctx, config) {
  // 1. Check if Target Table exists
  return `
BEGIN
  -- SCENARIO B: INCREMENTAL MERGE
  -- This will fail and jump to EXCEPTION if the table doesn't exist
  MERGE ${config.target_ref} T
  USING (
     SELECT * FROM (
       -- Deduplication Logic for Incremental
       SELECT *,
         ROW_NUMBER() OVER (
             PARTITION BY ${config.keys.map(k => `\`${k}\``).join(", ")}
             ORDER BY \`recordstamp\` DESC, IF(\`operation_flag\` = 'D', 'ZZ', \`operation_flag\`) DESC
         ) as rn
       FROM ${config.source_ref}
       WHERE \`recordstamp\` >= (SELECT IFNULL(MAX(\`recordstamp\`), TIMESTAMP('1940-12-25 05:30:00+00')) FROM ${config.target_ref})
       AND ${config.keys.map(k => `\`${k}\` IS NOT NULL`).join(" AND ")}
     ) WHERE rn = 1
  ) S
  ON ${config.keys.map(k => `T.\`${k}\` = S.\`${k}\``).join(" AND ")}

  -- 3. Handle Deletes
  WHEN MATCHED AND S.\`operation_flag\` = 'D' THEN DELETE

  -- 4. Handle Updates
  WHEN MATCHED AND S.\`operation_flag\` IN ('I','U','L') THEN UPDATE SET
    ${config.columns.filter(c => !config.keys.includes(c)).map(c => `\`${c}\` = S.\`${c}\``).join(",\n    ")}

  -- 5. Handle Inserts
  WHEN NOT MATCHED AND IFNULL(S.\`operation_flag\`, 'I') != 'D' THEN INSERT (
    ${config.columns.map(c => `\`${c}\``).join(", ")}
  ) VALUES (
    ${config.columns.map(c => `S.\`${c}\``).join(", ")}
  );

EXCEPTION WHEN ERROR THEN
  IF @@error.message LIKE '%Not found: Table%' THEN
    -- SCENARIO A: INITIAL LOAD
    CREATE OR REPLACE TABLE ${config.target_ref}
    ${(() => {
      if (!config.partition) return '';
      const col = `\`${config.partition.column}\``;
      const grain = config.partition.time_grain ? config.partition.time_grain.toUpperCase() : 'DAY';
      const isTimestamp = config.partition.data_type === 'TIMESTAMP' || config.partition.data_type === 'DATETIME';
      if (isTimestamp) {
        return grain === 'DAY' ? `PARTITION BY DATE(${col})` : `PARTITION BY TIMESTAMP_TRUNC(${col}, ${grain})`;
      } else {
        return grain === 'DAY' ? `PARTITION BY ${col}` : `PARTITION BY DATE_TRUNC(${col}, ${grain})`;
      }
    })()}
    ${config.cluster ? `CLUSTER BY ${config.cluster.columns.map(c => `\`${c}\``).join(",")}` : ''}
    AS
    SELECT ${config.columns.map(c => `\`${c}\``).join(", ")}
    FROM ${config.source_ref}
    WHERE ${config.keys.map(k => `\`${k}\` IS NOT NULL`).join(" AND ")}
    -- Deduplication Logic
    QUALIFY ROW_NUMBER() OVER (
        PARTITION BY ${config.keys.map(k => `\`${k}\``).join(", ")}
        ORDER BY \`recordstamp\` DESC, IF(\`operation_flag\` = 'D', 'ZZ', \`operation_flag\`) DESC
    ) = 1
    AND IFNULL(\`operation_flag\`, 'I') != 'D'; -- Exclude deletes on init

    ${config.table_description ? `ALTER TABLE ${config.target_ref} SET OPTIONS (description="""${config.table_description}""");` : ''}
    ${config.column_descriptions && Object.keys(config.column_descriptions).length > 0 ? `ALTER TABLE ${config.target_ref} ` + Object.entries(config.column_descriptions).filter(([c, _]) => config.columns.includes(c)).map(([c, d]) => `ALTER COLUMN \`${c}\` SET OPTIONS (description="""${d}""")`).join(',\n      ') + ';' : ''}
  ELSE
    RAISE USING MESSAGE = @@error.message;
  END IF;
END;
  `;
}

module.exports = { generateIncrementalMergeScript };
