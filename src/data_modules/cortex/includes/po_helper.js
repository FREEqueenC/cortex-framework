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

/**
 * Generates a SQL expression to calculate the open quantity.
 * The open quantity is the difference between the target and scheduled quantities,
 * unless the difference is negative or delivery is completed.
 * @param {number} targetQuantity The target quantity.
 * @param {number} scheduledQuantity The quantity already scheduled.
 * @param {string} deliveryCompletedFlag A flag indicating if delivery is completed ('X' for true).
 * @return {string} A SQL-like expression for the open quantity.
 */
function getOpenQuantity(targetQuantity, scheduledQuantity, deliveryCompletedFlag) {
  return `IF(((${targetQuantity} - ${scheduledQuantity}) < 0 OR ${deliveryCompletedFlag} = 'X'),
      0,
      (${targetQuantity} - ${scheduledQuantity})
    )`;
}

module.exports = {
  getOpenQuantity
};
