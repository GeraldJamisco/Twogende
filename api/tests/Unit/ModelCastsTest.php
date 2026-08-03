<?php

namespace Tests\Unit;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use ReflectionClass;
use Tests\TestCase;

/**
 * Guards against a bug that has now shipped three times: a new date, decimal
 * or boolean column added to a migration without the matching cast on the
 * model.
 *
 * The symptom is always the same and always far from the cause — a date comes
 * back as a string and blows up on ->diffInMinutes(), or a decimal arrives as
 * a string and quietly fails a comparison. Cheaper to catch here.
 */
class ModelCastsTest extends TestCase
{
    use RefreshDatabase;

    /** Eloquent handles these itself. */
    private const HANDLED_BY_ELOQUENT = ['created_at', 'updated_at', 'deleted_at'];

    public function test_every_date_decimal_and_boolean_column_has_a_cast(): void
    {
        $missing = [];

        foreach ($this->models() as $model) {
            $table = $model->getTable();

            if (! Schema::hasTable($table)) {
                continue;
            }

            $casts = $model->getCasts();

            foreach (Schema::getColumns($table) as $column) {
                $name = $column['name'];

                if (in_array($name, self::HANDLED_BY_ELOQUENT, true)) {
                    continue;
                }

                if (! $this->needsCast($column) || isset($casts[$name])) {
                    continue;
                }

                $missing[] = sprintf(
                    '%s::$casts is missing %s (%s)',
                    class_basename($model),
                    $name,
                    $column['type_name'],
                );
            }
        }

        $this->assertSame([], $missing, implode("\n", $missing));
    }

    /**
     * @param  array<string, mixed>  $column
     */
    private function needsCast(array $column): bool
    {
        $type = strtolower((string) $column['type_name']);

        // A bare tinyint is usually a small number, not a flag; only the
        // 1-width form is a boolean.
        if ($type === 'tinyint') {
            return str_contains(strtolower((string) $column['type']), 'tinyint(1)');
        }

        return in_array($type, [
            'date', 'datetime', 'timestamp',
            'decimal', 'float', 'double',
            'boolean', 'bool',
        ], true);
    }

    /**
     * @return list<Model>
     */
    private function models(): array
    {
        $models = [];

        foreach (glob(app_path('Models/*.php')) as $file) {
            $class = 'App\\Models\\'.Str::before(basename($file), '.php');

            if (! class_exists($class)) {
                continue;
            }

            $reflection = new ReflectionClass($class);

            if (! $reflection->isSubclassOf(Model::class) || $reflection->isAbstract()) {
                continue;
            }

            $models[] = new $class;
        }

        return $models;
    }

    public function test_soft_deleting_models_still_cast_deleted_at(): void
    {
        // Belt and braces: the trait does this, but a model that declares its
        // own casts array without calling parent would silently lose it.
        foreach ($this->models() as $model) {
            if (! in_array(SoftDeletes::class, class_uses_recursive($model), true)) {
                continue;
            }

            $this->assertArrayHasKey(
                'deleted_at',
                $model->getCasts(),
                class_basename($model).' soft deletes but does not cast deleted_at.',
            );
        }
    }
}
