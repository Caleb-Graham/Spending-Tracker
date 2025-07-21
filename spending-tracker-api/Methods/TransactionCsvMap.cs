using CsvHelper.Configuration;
using System.Globalization;

namespace SpendingTrackerApi.Methods;

public sealed class TransactionCsvMap : ClassMap<TransactionCsvRecord>
{
    public TransactionCsvMap()
    {
        Map(m => m.Date)
            .Name("Date")
            .TypeConverterOption.Format("MM/dd/yyyy");

        Map(m => m.Category)
            .Name("Category");

        Map(m => m.Amount)
            .Name("Amount")
            .TypeConverterOption.NumberStyles(NumberStyles.Any);

        Map(m => m.Note)
            .Name("Note")
            .Optional();

        Map(m => m.Account)
            .Name("Account");
    }
}
