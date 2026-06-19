namespace volontiamo.api.Users;

public record ValidationError(string Field, string Message);

public enum ResultStatus
{
    Ok,
    NotFound,
    Conflict,
    ValidationError
}

public class Result<T>
{
    public T? Value { get; }
    public ResultStatus Status { get; }
    public string? ErrorMessage { get; }
    public IReadOnlyList<ValidationError> Errors { get; }

    private Result(T? value, ResultStatus status, string? errorMessage = null, IReadOnlyList<ValidationError>? errors = null)
    {
        Value = value;
        Status = status;
        ErrorMessage = errorMessage;
        Errors = errors ?? [];
    }

    public static Result<T> Success(T value) => new(value, ResultStatus.Ok);
    public static Result<T> NotFound() => new(default, ResultStatus.NotFound);
    public static Result<T> Conflict(string message) => new(default, ResultStatus.Conflict, message);
    public static Result<T> ValidationFailure(IReadOnlyList<ValidationError> errors) => new(default, ResultStatus.ValidationError, errors: errors);
}
