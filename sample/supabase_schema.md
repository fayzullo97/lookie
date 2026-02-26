
# Supabase Database Schema Specification

This document outlines the database structure, storage buckets, and analytics views required for the Virtual Try-On Bot.

## 1. Tables

### `users`
*Stores persistent user data, replacing the `UserSession` and `UserAnalyticsProfile` objects.*

| Column Name | Data Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `id` | `bigint` | **PK** | The Telegram Chat ID. |
| `username` | `text` | | Telegram username (optional). |
| `first_name` | `text` | | User's first name. |
| `language` | `text` | | 'uz' or 'ru'. |
| `credits` | `integer` | Default `30` | Current credit balance. |
| `current_state` | `text` | | e.g., 'AWAITING_OUTFITS', 'COMPLETED'. |
| `model_gender` | `text` | | 'male' or 'female' (detected by Gemini). |
| `last_monthly_grant`| `text` | | YYYY-MM format to track free monthly credits. |
| `created_at` | `timestamptz`| Default `now()`| When the user first started the bot. |
| `last_active_at` | `timestamptz`| | Updated on every interaction. |

### `model_images`
*Stores the user's uploaded body photos. Replaces `modelImage` in session.*

| Column Name | Data Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | **PK**, Default `gen_random_uuid()` | Unique ID for the image. |
| `user_id` | `bigint` | **FK** -> `users.id` | The user who owns this image. |
| `storage_path` | `text` | | Path in Supabase bucket (e.g., `models/12345/abc.jpg`). |
| `is_current` | `boolean` | Default `false` | True if this is the currently selected model. |
| `is_original` | `boolean` | Default `true` | True if this is the raw upload, False if it's a generated result used as input. |
| `created_at` | `timestamptz`| Default `now()` | |

### `outfit_queue`
*Stores the temporary items (clothes) the user has uploaded but not yet generated a look for. Replaces `outfitItems` in session.*

| Column Name | Data Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | **PK**, Default `gen_random_uuid()` | |
| `user_id` | `bigint` | **FK** -> `users.id` | |
| `storage_path` | `text` | | Path in Supabase bucket (e.g., `outfits/12345/xyz.png`). |
| `category` | `text` | | 'outfit', 'shoes', 'bag', etc. |
| `description` | `text` | | AI generated description of the item. |
| `mime_type` | `text` | | 'image/jpeg' or 'image/png'. |
| `created_at` | `timestamptz`| Default `now()` | |

### `generations`
*A history of all AI generation attempts. This serves as the source of truth for your Analytics (Success rates, Total Generations, etc).*

| Column Name | Data Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | **PK**, Default `gen_random_uuid()` | |
| `user_id` | `bigint` | **FK** -> `users.id` | |
| `input_prompt` | `text` | | The final prompt sent to Gemini. |
| `result_image_path` | `text` | | Path to result in Storage (nullable if failed). |
| `status` | `text` | | 'success', 'failed', 'safety_block'. |
| `error_message` | `text` | | If failed, store the error reason. |
| `cost_credits` | `integer` | | How many credits this cost (e.g., 10 or 20). |
| `cost_usd_est` | `numeric` | | Estimated API cost (e.g., 0.04). |
| `created_at` | `timestamptz`| Default `now()` | |

### `transactions`
*Financial ledger for credits. Replaces the simple credit addition logic.*

| Column Name | Data Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | **PK**, Default `gen_random_uuid()` | |
| `user_id` | `bigint` | **FK** -> `users.id` | |
| `amount` | `integer` | | Positive (add) or Negative (spend). |
| `type` | `text` | | 'purchase', 'gift', 'usage', 'monthly_grant', 'refund'. |
| `amount_paid_uzs` | `integer` | | Real money paid (0 if gift/usage). |
| `provider_id` | `text` | | Telegram/Provider payment ID (for debugging). |
| `created_at` | `timestamptz`| Default `now()` | |

## 2. Storage Buckets

Create these buckets in **Supabase Storage**:

1.  **`user-uploads`**:
    *   Folder `models/`: Stores user body photos.
    *   Folder `items/`: Stores outfit/clothing photos.
2.  **`generated-results`**:
    *   Stores the final AI output images.

## 3. Analytics (Views)

Create these SQL Views in the SQL Editor to calculate real-time analytics without needing separate tables.

**`daily_metrics_view`**
```sql
SELECT 
  date_trunc('day', created_at) as date, 
  count(*) as total_gens,
  count(*) filter (where status = 'success') as success_gens
FROM generations 
GROUP BY 1;
```

**`funnel_view`**
```sql
SELECT
  (SELECT count(*) FROM users) as total_users,
  (SELECT count(DISTINCT user_id) FROM model_images) as users_with_model,
  (SELECT count(DISTINCT user_id) FROM generations) as users_who_generated
```
